import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";

/**
 * E2E test covering the full password reset (forgot password) flow for a
 * verified user.
 *
 * Business context: For security, only email-verified users can reset their
 * passwords. The typical flow is:
 *
 * 1. User registers an account and verifies their email.
 * 2. Initiates a password reset with their email address
 *    (request-password-reset endpoint).
 * 3. Receives a reset token (e.g., via email, but for this test, it is
 *    acquired directly/implicitly from backend/mocks).
 * 4. Submits the token, userId, and new password to the reset-password
 *    endpoint.
 * 5. Can successfully login with the new password. Any past sessions should be
 *    invalidated per security policy.
 *
 * Technical note: The test obtains both the email verification token and
 * the password reset token by generating random strings with
 * typia.random<string>() because the real system sends these by email and
 * does not expose them via the API. In test/simulation environments, direct
 * access would be achieved via DB or special API/test helpers. If running
 * this test against a production-like or locked system, adapt accordingly.
 *
 * Steps implemented:
 *
 * 1. Register a new user (random email, strong password).
 * 2. Simulate acquiring the email verification token (in real-world, via email
 *    or DB; here, use typia.random<string>).
 * 3. Verify the user's email with the token and userId.
 * 4. Initiate password reset (simulate 'forgot password'), creating a password
 *    reset request.
 * 5. Simulate acquiring the password reset token (again, use
 *    typia.random<string> for test purposes).
 * 6. Reset the password with the token, userId, and new valid password.
 * 7. Login with the new password and verify ownership.
 */
export async function test_api_user_reset_password_success(
  connection: api.IConnection,
) {
  // 1. Register a new user (unique email, strong password)
  const originalPassword = RandomGenerator.alphaNumeric(12) + "Aa1!";
  const joinInput = {
    email: typia.random<string & tags.Format<"email">>(),
    password: originalPassword,
  } satisfies ITodoListUser.IJoin;
  const joinResp = await api.functional.auth.user.join(connection, {
    body: joinInput,
  });
  typia.assert(joinResp);
  const userId = joinResp.user.id;
  const testEmail = joinResp.user.email;

  // 2. Simulate acquiring the email verification token
  //    (normally sent via email; in E2E we use a random string for test/mocked env)
  const emailVerifyToken: string = typia.random<string>();
  const emailVerifyBody = {
    user_id: userId,
    token: emailVerifyToken,
  } satisfies ITodoListUser.IVerifyEmail;
  await api.functional.auth.user.verify_email.verifyEmail(connection, {
    body: emailVerifyBody,
  });

  // 3. Request password reset (forgot password flow)
  const pwResetReq = {
    email: testEmail,
  } satisfies ITodoListUser.IRequestPasswordReset;
  const resetReqResp =
    await api.functional.auth.user.request_password_reset.requestPasswordReset(
      connection,
      { body: pwResetReq },
    );
  typia.assert(resetReqResp);
  TestValidator.predicate(
    "Password reset request for verified user must succeed",
    resetReqResp.success,
  );

  // 4. Simulate acquiring the password reset token
  //    (in production, received via email; for test env, generate random string)
  const resetToken: string = typia.random<string>();
  const newPassword = RandomGenerator.alphaNumeric(16) + "!Bb2";
  const resetBody = {
    token: resetToken,
    user_id: userId,
    new_password: newPassword,
  } satisfies ITodoListUser.IResetPassword;
  const resetResp = await api.functional.auth.user.reset_password.resetPassword(
    connection,
    { body: resetBody },
  );
  typia.assert(resetResp);
  TestValidator.predicate(
    "Password must be successfully reset with valid token",
    resetResp.success,
  );

  // 5. Login with the new password to ensure the reset was effective
  const loginBody = {
    email: testEmail,
    password: newPassword,
  } satisfies ITodoListUser.ILogin;
  const loginResp = await api.functional.auth.user.login(connection, {
    body: loginBody,
  });
  typia.assert(loginResp);
  TestValidator.equals(
    "Logged-in user's id matches reset user",
    loginResp.user.id,
    userId,
  );
}
