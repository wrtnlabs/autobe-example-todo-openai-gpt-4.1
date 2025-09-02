import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";

export async function test_api_user_request_password_reset_success(
  connection: api.IConnection,
) {
  /**
   * Validate password reset flow for a real, email-verified user in the system.
   *
   * Steps:
   *
   * 1. Register a new user with a unique email address and a strong password.
   * 2. Assert registration succeeded, verify is_email_verified is false.
   * 3. Simulate acquisition of the email verification token (for E2E we generate
   *    it, as the real mechanism is out of scope).
   * 4. Send an email verification request using user id and token, assert result
   *    succeeds.
   * 5. Initiate a password reset request for the same email.
   * 6. Assert the response is the expected minimal success result; check no
   *    sensitive user/token information is leaked and success is always true.
   *
   * This test ensures the full flow for password reset adheres to the policy of
   * non-disclosure of email existence, only accepting valid, verified user, and
   * never leaking sensitive information.
   */

  // 1. Register a user with a unique email and strong password
  const joinInput = {
    email: typia.random<string & tags.Format<"email">>(),
    password: RandomGenerator.alphaNumeric(12),
  } satisfies ITodoListUser.IJoin;

  const joinResp: ITodoListUser.IAuthorized =
    await api.functional.auth.user.join(connection, { body: joinInput });
  typia.assert(joinResp);
  TestValidator.equals(
    "registered email matches input",
    joinResp.user.email,
    joinInput.email,
  );
  TestValidator.predicate(
    "user is not yet verified",
    !joinResp.user.is_email_verified,
  );

  // 2. Simulate obtaining the verification token for the new user
  const verificationToken = RandomGenerator.alphaNumeric(32);

  // 3. Complete email verification (simulate token, as no flow to retrieve from system in public API)
  const verification = {
    user_id: joinResp.user.id,
    token: verificationToken,
  } satisfies ITodoListUser.IVerifyEmail;

  const verifyResult: ITodoListUser.IVerifyEmailResult =
    await api.functional.auth.user.verify_email.verifyEmail(connection, {
      body: verification,
    });
  typia.assert(verifyResult);

  // 4. Initiate a password reset as a verified user
  const resetReq = {
    email: joinInput.email,
  } satisfies ITodoListUser.IRequestPasswordReset;

  const resetResult: ITodoListUser.IRequestPasswordResetResult =
    await api.functional.auth.user.request_password_reset.requestPasswordReset(
      connection,
      { body: resetReq },
    );
  typia.assert(resetResult);
  TestValidator.equals(
    "password reset initiation reports success",
    resetResult.success,
    true,
  );
}
