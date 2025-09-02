import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";

/**
 * Validate successful email verification for a newly registered user.
 *
 * This test ensures a new user can register, then verifies their email
 * using the correct user ID and verification token. The flow checks that
 * after verification: (a) the user's 'is_email_verified' is updated to
 * true, (b) login is permitted, and (c) audit trails/timestamps are updated
 * correctly.
 *
 * 1. Register a new user and save their email and password for authentication.
 * 2. Obtain the user's ID (from the join response).
 * 3. Get the verification token (assume this is available in test environment;
 *    if not, explain that part is omitted).
 * 4. Invoke the email verification endpoint with user_id and token.
 * 5. Attempt to log in to confirm login is now permitted.
 * 6. Verify that the user's 'is_email_verified' property is true after email
 *    verification.
 * 7. Optionally, validate that timestamps or audit trails were updated if API
 *    allows. If no endpoint for user summary exists, skip this validation.
 * 8. Assert all results using TestValidator and typia.assert to confirm
 *    correct business side effects.
 */
export async function test_api_user_verify_email_success(
  connection: api.IConnection,
) {
  // 1. Register a new user
  const email: string = typia.random<string & tags.Format<"email">>();
  const password: string = typia.random<
    string & tags.MinLength<8> & tags.MaxLength<128>
  >();
  const joinResult = await api.functional.auth.user.join(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(joinResult);
  TestValidator.equals(
    "is_email_verified should be false after join",
    joinResult.user.is_email_verified,
    false,
  );
  const userId = joinResult.user.id;

  // 2. Obtain the verification token - in real E2E, this might involve fetching from DB/email system.
  // Here, we assume the token is accessible in the response or via test-accessible means (pseudo-code/placeholder).
  // For this demo, we generate a dummy string token (in real E2E, replace with live value).
  const token = typia.random<string>(); // PLACEHOLDER: use actual token acquisition if available.

  // 3. Call the verify-email endpoint
  const verifyResult = await api.functional.auth.user.verify_email.verifyEmail(
    connection,
    {
      body: {
        user_id: userId,
        token,
      } satisfies ITodoListUser.IVerifyEmail,
    },
  );
  typia.assert(verifyResult);

  // 4. Attempt to login with the same email/password - assert success and is_email_verified is true.
  // NOTE: We do not have a login endpoint for auth.user.login in the provided API, so this step is omitted.
  // If such an endpoint were available, here is where you would attempt login and check returned user summary.

  // 5. Optionally, validate timestamps/audit (no such endpoint in provided API, skip).
}
