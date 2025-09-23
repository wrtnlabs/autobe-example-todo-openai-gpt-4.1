# Business Rules and Validation Logic for Minimal Todo List Application

## Task Content and Length Rules

- THE system SHALL allow only plain text content in each todo item. No images, attachments, or formatting tags are permitted.

- THE system SHALL require that the task description not be empty and contain only printable, non-control characters except for newlines.

- THE system SHALL enforce a minimum length of 1 character and a maximum length of 255 characters (excluding whitespace padding) for task content.

- WHEN a user attempts to create or update a todo with content exceeding 255 characters, THE system SHALL reject the request and present a descriptive error.

- IF the content field is all whitespace, THEN THE system SHALL treat it as empty and reject the todo creation or update.

- THE system SHALL trim leading and trailing whitespace from task content before applying length or emptiness checks.

- IF a todo's content contains potentially harmful code (such as <script> tags), THEN THE system SHALL reject the todo and return a sanitization error.


## Due Date Logic

- THE system SHALL allow, but not require, an optional due date for each todo.

- WHEN a due date is specified, THE system SHALL require it to be a valid ISO 8601 date (yyyy-mm-dd) and not earlier than the current date.

- IF a user attempts to set a due date in the past, THEN THE system SHALL reject the request and return a validation error.

- IF a user submits a due date in an invalid format, THEN THE system SHALL return a validation error specifying the required format.

- WHEN a todo is created without a due date, THE system SHALL store it as null or undefined for the due date field.

- THE system SHALL not allow the due date to be changed to a value earlier than the todo's creation date.

- WHEN marking a todo as completed, THE system SHALL not lock or alter the due date field.


## Ownership and Data Access

- THE system SHALL associate every todo item with the user (by unique user ID) who created it. Ownership is strictly enforced by business logic.

- WHEN a user attempts to access, update, or delete a todo, THE system SHALL verify that the requesting user is the owner of the todo (unless the user holds the admin role).

- IF a user attempts to access, update, or delete a todo they do not own and are not an admin, THEN THE system SHALL deny access and present an authorization error.

- WHEN an admin user attempts to view or delete any user's todo, THE system SHALL permit the action.

- THE system SHALL never reveal or allow update/delete access to a user's todos by another user unless the requesting party is an admin.

- WHEN deleting a user, THE system SHALL delete or anonymize all todos associated with that user, according to data retention policy.

- THE system SHALL support user-level querying: users may only see their own todos, even when querying task lists; admins may access all users' todos as needed.

- IF a user requests a list of todos, THEN THE system SHALL return only those belonging to the requesting user (unless admin).


## Edge Cases and Prohibited Operations

- IF a todo task is already marked as completed and a user attempts to mark it completed again, THEN THE system SHALL ignore the action and return success without changing state.

- IF a user attempts to update or delete a todo that does not exist, THEN THE system SHALL respond with an error indicating the todo is not found.

- WHEN a user attempts to delete a completed todo, THE system SHALL permit deletion following the same rules as for incomplete tasks.

- THE system SHALL not permit the creation of multiple todos with identical content for the same user, if submitted within the same minute (deduplication window).

- IF a user attempts to submit two identical tasks within the deduplication window, THEN THE system SHALL reject the second submission with a deduplication error message.

- THE system SHALL not allow re-assignment or transfer of ownership of existing todo items between users via any operation.

- THE system SHALL not permit users to directly manipulate system meta-fields (such as creation timestamp, completion timestamp, or user IDs)—these are system-controlled only.

- WHEN a user or admin queries for all tasks, THE system SHALL apply system-level filtering and sorting according to business logic and only expose fields allowed by the business rules.


---

For related material, refer to the [Functional Requirements Document](./03-functional-requirements.md), [User Roles and Authentication Document](./02-user-roles-and-authentication.md), and [Error Handling and Recovery Guide](./07-error-handling-and-recovery.md).
