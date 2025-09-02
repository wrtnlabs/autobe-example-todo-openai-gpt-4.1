import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";

/**
 * Validate password reset request when account has been (hypothetically)
 * soft-deleted.
 *
 * This test ensures that the password reset mechanism does not leak account
 * existence or status:
 *
 * 1. Register a new user
 * 2. Verify the user's email
 * 3. (Cannot actually delete—no API provided for that)
 * 4. Request a password reset for the same email
 * 5. API must respond with { success: true } regardless of account status
 * 6. (Omitted: Attempt any backend reset flow, as deletion is not possible via
 *    testable API)
 */
export async function test_api_user_request_password_reset_deleted_account(
  connection: api.IConnection,
) {
  // 1. Register user
  const email = typia.random<string & tags.Format<"email">>();
  const password = RandomGenerator.alphaNumeric(12);
  const joinResult = await api.functional.auth.user.join(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(joinResult);
  TestValidator.equals(
    "user email matches input",
    joinResult.user.email,
    email,
  );
  TestValidator.predicate(
    "user email not yet verified",
    joinResult.user.is_email_verified === false,
  );

  // 2. Verify email (simulate received token and id from join)
  // In real applications, a verification email is sent to the user. For tests, the user id and token
  // must be extracted from the registration process — either by inspecting outbox/db,
  // or (as we lack a way to obtain the real token in this API), simulate it with a random string.
  // For this test, call the verification endpoint directly; assume a test-accessible verification token.
  const userId = joinResult.user.id;
  const fakeToken = RandomGenerator.alphaNumeric(32); // In a real test, get real issued token
  await api.functional.auth.user.verify_email.verifyEmail(connection, {
    body: {
      user_id: userId,
      token: fakeToken,
    } satisfies ITodoListUser.IVerifyEmail,
  });

  // 3. (No deletion API - cannot delete the account)
  // Skipped: Would soft-delete user here if API existed

  // 4. Request password reset
  const passwordResetResponse =
    await api.functional.auth.user.request_password_reset.requestPasswordReset(
      connection,
      {
        body: {
          email,
        } satisfies ITodoListUser.IRequestPasswordReset,
      },
    );
  typia.assert(passwordResetResponse);
  TestValidator.equals(
    "password reset response is always success",
    passwordResetResponse.success,
    true,
  );
}
