import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

export async function test_api_user_request_password_reset_email_not_registered(
  connection: api.IConnection,
) {
  /**
   * Test requesting password reset for a non-existent email address.
   *
   * Purpose:
   *
   * - Validate that the password reset endpoint does not reveal account
   *   existence.
   * - Ensure a generic success response (success=true) is always returned for
   *   syntactically valid email requests, even if the user does not exist in
   *   the system.
   *
   * Steps:
   *
   * 1. Compose a valid email address that is almost guaranteed not to exist in the
   *    system (random value).
   * 2. Request password reset for this email via the API.
   * 3. Validate that the response indicates success and does not leak account
   *    presence or error information.
   * 4. Validate response type structure.
   * 5. (Edge) Repeat the request to reinforce idempotence and anti-enumeration
   *    logic.
   */

  // Step 1: Compose likely non-existent valid email.
  const unregisteredEmail: string & tags.Format<"email"> =
    `${RandomGenerator.alphaNumeric(15)}@unregistered-example.com`;

  // Step 2: Request password reset with this email.
  const result: ITodoListUser.IRequestPasswordResetResult =
    await api.functional.auth.user.request_password_reset.requestPasswordReset(
      connection,
      {
        body: {
          email: unregisteredEmail,
        } satisfies ITodoListUser.IRequestPasswordReset,
      },
    );

  // Step 3: Validate success response.
  TestValidator.equals(
    "password reset request for unregistered email always returns success",
    result.success,
    true,
  );

  // Step 4: Validate response type structure.
  typia.assert(result);

  // Step 5: (Edge) Repeat the request; it should behave identically.
  const repeatResult: ITodoListUser.IRequestPasswordResetResult =
    await api.functional.auth.user.request_password_reset.requestPasswordReset(
      connection,
      {
        body: {
          email: unregisteredEmail,
        } satisfies ITodoListUser.IRequestPasswordReset,
      },
    );
  TestValidator.equals(
    "repeated password reset request for same unregistered email also returns success",
    repeatResult.success,
    true,
  );
  typia.assert(repeatResult);
}
