# Permission Matrix for Todo List Application

## Introduction to Permission Model

The Todo List application employs a robust and explicit role-based access control model to ensure clear boundaries and full business visibility of permissions for all actions in the system. The intent is to guarantee privacy, prevent accidental or malicious access to data, and support business processes by defining precisely who can do what, using clear business terms. The two primary roles are:

- **User**: A registered user who can only interact with their own todo items.
- **Admin**: A privileged system administrator with universal oversight, capable of managing users and moderating any todo content.

Both roles are fundamental to the security and reliable business operation of the Todo List application. Permissions must be enforced at every entry point in natural language business terms, not via implicit technical limitations.

## Permission Matrix by Role and Action

The canonical matrix below lists all business-permitted actions per role and serves as the implementation reference for backend access controls. Matrix aligns with the business rules and authentication requirements set elsewhere.

| Action                                 | User | Admin |
|----------------------------------------|:----:|:-----:|
| Register account                       | ✅   | ✅    |
| Login                                  | ✅   | ✅    |
| Create todo (own)                      | ✅   | ✅    |
| View all own todos                     | ✅   | ✅    |
| Edit todo (own)                        | ✅   | ✅    |
| Mark todo complete/incomplete (own)    | ✅   | ✅    |
| Delete todo (own)                      | ✅   | ✅    |
| View all users' todos                  | ❌   | ✅    |
| Edit any user's todo                   | ❌   | ✅    |
| Delete any user's todo                 | ❌   | ✅    |
| Manage user accounts                   | ❌   | ✅    |
| Moderate inappropriate todo content    | ❌   | ✅    |
| View/administer application settings   | ❌   | ✅    |

### Permission Matrix Key
- ✅ Permitted
- ❌ Not permitted

## Detailed Permissions and EARS Requirements

### Universal Enforcement
- THE system SHALL authenticate every user before allowing any action on todos or user data.
- THE system SHALL grant only the minimum set of permissions required for a user's assigned role.

### User Role Requirements
- THE user SHALL create, read, update, and delete only their own todos.
- IF a user attempts to access, view, edit, or delete any todo not owned by themselves, THEN THE system SHALL deny the action, provide an appropriate business error message, and log the attempt.
- THE user SHALL NOT perform any action on accounts or content not associated to their identity.

### Admin Role Requirements
- THE admin SHALL perform any CRUD (create/read/update/delete) operation on any user's todo item as required by moderation or support processes.
- THE admin SHALL manage (activate, deactivate, or delete) any user account.
- THE admin SHALL moderate todos system-wide for inappropriate or suspect content.
- WHEN an admin deletes or modifies another user's todo, THE system SHALL log that moderation action explicitly and record who performed the operation.
- IF an admin acts outside business policy (e.g., unwarranted deletion), THEN THE system SHALL audit and flag that action for review.

### Shared and Prohibited Actions
- IF any attempt is made to create a todo for another user (not self), THEN THE system SHALL deny the operation regardless of role, unless the action is by admin as part of a user assistance process.
- IF a non-admin attempts to manage user accounts, moderation, or application-level settings, THEN THE system SHALL reject and log the unauthorized operation, returning a role violation business error.
- THE system SHALL always display clear error messaging for denied actions, referencing what is allowed per the user's role.

### Automatic and Edge-case Rules
- WHEN any user logs out or their session expires, THE system SHALL revoke all permissions and require re-authentication before allowing further resource access.
- WHERE admin impersonation (admin acting as user) is required for customer support under business procedure, THE system SHALL log the start and end of every impersonated session.
- WHEN an admin disables a user or deletes a user account, THE system SHALL immediately revoke all of that user’s active sessions and permissions.
- IF a user is deactivated for violation of terms, THEN THE system SHALL prevent login or any access attempt and display a clear business message.

## Common Permission Scenarios in EARS Format

### Scenario 1: User CRUD Operations
- WHEN a user is authenticated, THE system SHALL allow the user to create, view, update, and delete todos assigned only to their own account.
- IF a user attempts to edit or delete a todo not their own, THEN THE system SHALL reject the request, display an access denied message, and log the violation for compliance.

### Scenario 2: Admin Moderation and User Management
- WHEN an admin is authenticated, THE system SHALL allow the admin to view, edit, delete, or moderate any todo item in the system.
- WHEN an admin edits or deletes another user's todo, THE system SHALL record this action in audit logs with a reason (if supplied).
- WHEN an admin disables or deletes a user account, THE system SHALL revoke all current sessions for that user immediately.
- IF an admin attempts to perform any function outside the business rules, THEN THE system SHALL log the incident for audit and elevate to business review if required.

### Scenario 3: Unauthorized Access Attempts
- IF an unauthenticated user attempts to view, create, edit, or delete any todo, THEN THE system SHALL block the action, prompt for login, and reject the access attempt with a user-appropriate error message.
- IF a non-admin attempts an admin-only action (e.g., manage users, moderate content), THEN THE system SHALL deny the action, log it, and provide corrective business messaging.

### Scenario 4: Permissions Upon Role Change or Session End
- WHEN a user's role is changed—such as promotion to or demotion from an admin role—THE system SHALL update permissions and enforce new access controls from the next authenticated session onwards.
- WHEN any user logs out, is deleted, or is deactivated, THE system SHALL immediately terminate all active sessions and remove any access rights.

### Scenario 5: Application Settings Administration
- WHERE the application maintains system-level settings, THE system SHALL allow only admin users to access or change these business configurations. IF a regular user attempts such action, THEN THE system SHALL block, log, and return a role-appropriate business error.

## Integration with Other Business Documents
- The permission matrix and requirements above are canonical for backend access enforcement. All backend features and endpoints MUST check permissions according to this document before taking action.
- For full role structure and authentication details, see [User Roles and Authentication](./02-user-roles-and-authentication.md).
- For validation-related access control and input rules, reference [Business Logic and Validation Rules](./07-business-logic-and-validation.md).
- For auditing and compliance, consult [Security and Compliance Requirements](./10-security-and-compliance.md).

## Summary Table: Permission Enforcement EARS Requirements

| Requirement Target        | EARS Requirement                                                                                                                                                             |
|--------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| All actions              | THE system SHALL validate the user's role for every action before proceeding.                                                                                                |
| Unauthorized attempts    | IF a user or admin action violates the matrix above, THEN THE system SHALL block the action, return an explicit error, and log the event.                                   |
| Admin moderation         | WHEN an admin moderates, THE system SHALL log the event, capture who/when/why, and notify relevant business monitoring flows (as required by [Security and Compliance]).     |
| User session lifecycle   | WHEN any user logs out or is deactivated, THE system SHALL immediately terminate all sessions and permissions for that user.                                                  |
| Role change              | WHEN a user's role changes, THE system SHALL enforce new permissions effective from the next login/session renewal.                                                          |

----

This document specifies business requirements for permission enforcement only. All technical implementation specifics (API structure, data access patterns, etc.) are fully at the discretion of the development team. Use this matrix and requirements as the exclusive authority for role-based access control throughout the Todo List application.