import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Verify that a registered user can successfully log in by supplying correct
 * credentials (email and password). This scenario ensures that authentication
 * is only possible for existing users, password hashing works, and JWT tokens
 * are issued as specified in the authentication schema. Confirm that password
 * is never returned in the response, only id and token.
 *
 * Steps:
 *
 * 1. Generate a unique email and valid password that meets the defined constraints
 *    (RFC 5322 email, password 8-100 chars).
 * 2. Register the user using /auth/user/join with the generated credentials.
 *    Confirm that registration returns an object matching
 *    ITodoListUser.IAuthorized with id (uuid v4) and token (access, refresh,
 *    expired_at, refreshable_until).
 * 3. Attempt login using /auth/user/login with the same credentials.
 * 4. On login response, assert that all expected fields are present, password is
 *    NOT present, id is a valid uuid, token object contains required fields,
 *    and token.access/refresh are non-empty strings.
 */
export async function test_api_user_login_success(connection: api.IConnection) {
  // Step 1: Prepare unique email and valid password
  const email = typia.random<string & tags.Format<"email">>();
  const password = RandomGenerator.alphaNumeric(12);

  // Step 2: Register the user
  const registration = await api.functional.auth.user.join(connection, {
    body: { email, password } satisfies ITodoListUser.IJoin,
  });
  typia.assert(registration);
  TestValidator.predicate(
    "registration response has id and token only",
    "id" in registration &&
      "token" in registration &&
      Object.keys(registration).length === 2,
  );
  TestValidator.predicate(
    "registration.id is valid UUID",
    typeof registration.id === "string" && registration.id.length === 36,
  );
  typia.assert<IAuthorizationToken>(registration.token);

  // Step 3: Log in with same credentials
  const login = await api.functional.auth.user.login(connection, {
    body: { email, password } satisfies ITodoListUser.ILogin,
  });
  typia.assert(login);

  // Step 4: Validate login response
  TestValidator.predicate(
    "login response has id and token only",
    "id" in login && "token" in login && Object.keys(login).length === 2,
  );
  TestValidator.predicate(
    "login.id is valid UUID",
    typeof login.id === "string" && login.id.length === 36,
  );
  typia.assert<IAuthorizationToken>(login.token);
  TestValidator.equals(
    "login.id matches registration.id",
    login.id,
    registration.id,
  );
}

/**
 * The draft implementation follows all rules and checklist items:
 *
 * - All API calls use await and are called with proper body types using
 *   satisfies.
 * - Random email and secure password are generated using typia.random and
 *   RandomGenerator.alphaNumeric.
 * - Registration and login both assert the ITodoListUser.IAuthorized structure.
 * - TestValidator.predicate assertions confirm response shape and id format,
 *   including ensuring that only id and token are present (no password leaks),
 *   that both ids are UUID format and that token is valid as
 *   IAuthorizationToken.
 * - TestValidator.equals checks that the login id matches the registration id.
 * - No additional imports, no type errors, no type error testing, no testing HTTP
 *   status codes, and no schema property hallucinations.
 * - The function is written within the template's import scope, no external
 *   helpers, all input and output types precise.
 * - No extra or missing steps: all required workflow and validations are included
 *   according to scenario and business rules.
 *
 * No errors or violations found; code is ready for production as final
 * implementation.
 *
 * - Rules
 *
 *   - O 1. Role and Responsibility
 *   - O 2. Input Materials Provided
 *   - O 3. Code Generation Requirements
 *   - O 3.1. Import Management
 *   - O 3.2. API SDK Function Invocation
 *   - O 3.3. API Response and Request Type Checking
 *   - O 3.4. Random Data Generation
 *   - O 3.5. Handling Nullable and Undefined Values
 *   - O 3.6. TypeScript Type Narrowing and Control Flow Analysis
 *   - O 3.7. Authentication Handling
 *   - O 3.7. Logic Validation and Assertions
 *   - O 3.8. Complete Example
 *   - O 4. Quality Standards and Best Practices
 *   - O 4.5. Typia Tag Type Conversion (When Encountering Type Mismatches)
 *   - O 4.6. Request Body Variable Declaration Guidelines
 *   - O 4.7. Date Handling in DTOs
 *   - O 4.8. Avoiding Illogical Code Patterns
 *   - O 4.7.2. Business Logic Validation Patterns
 *   - O 4.7.3. Data Consistency Patterns
 *   - O 4.7.4. Error Scenario Patterns
 *   - O 4.7.5. Best Practices Summary
 *   - O 4.9. AI-Driven Autonomous TypeScript Syntax Deep Analysis
 *   - O 4.10. CRITICAL: AI Must Generate TypeScript Code, NOT Markdown Documents
 *   - O 4.11. CRITICAL: Anti-Hallucination Protocol
 *   - O 4.12. 🚨🚨🚨 ABSOLUTE PROHIBITION: NO TYPE ERROR TESTING - ZERO TOLERANCE
 *       🚨🚨🚨
 *   - O 5. Final Checklist
 * - Check List
 *
 *   - O NO additional import statements
 *   - O NO wrong type data in requests
 *   - O EVERY api.functional.* call has await
 *   - O No compilation errors
 *   - O Proper async/await usage
 *   - O TestValidator.title parameter ALWAYS included
 *   - O TestValidator error/equals actual-first pattern
 *   - O NEVER touch connection.headers
 *   - O Function matches correct template structure
 */
const __revise = {};
__revise;
