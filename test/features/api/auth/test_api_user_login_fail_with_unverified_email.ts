import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";

export async function test_api_user_login_fail_with_unverified_email(
  connection: api.IConnection,
) {
  /**
   * Test that logging in with an unverified email is rejected by the
   * authentication system.
   *
   * Scenario:
   *
   * 1. Register a user (valid email & password) without verifying their email
   *    address.
   * 2. Assert that the registration succeeds and the user's is_email_verified flag
   *    is false.
   * 3. Attempt to login using the same credentials.
   * 4. Assert that login fails with an error indicating email verification is
   *    required.
   *
   * This ensures the system enforces mandatory email verification prior to
   * authentication.
   */
  // Step 1: Register a new user (without verifying email)
  const email: string = typia.random<string & tags.Format<"email">>();
  const password: string = RandomGenerator.alphaNumeric(12); // Must meet minLength<8> & maxLength<128>

  const registration = await api.functional.auth.user.join(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(registration);
  TestValidator.equals(
    "user should not be email-verified immediately after registration",
    registration.user.is_email_verified,
    false,
  );

  // Step 2: Attempt to login using the same credentials (should fail due to unverified email)
  await TestValidator.error(
    "login attempt with unverified email should fail",
    async () => {
      await api.functional.auth.user.login(connection, {
        body: {
          email,
          password,
        } satisfies ITodoListUser.ILogin,
      });
    },
  );
}
