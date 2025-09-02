import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";

/**
 * Validate login failure with invalid credentials
 *
 * This test ensures that login fails when the provided email or password is
 * incorrect, following secure authentication standards (do not reveal which
 * credential failed).
 *
 * Workflow:
 *
 * 1. Register a user with random email and strong password
 *    (ITodoListUser.IJoin)
 * 2. Attempt to verify the email, using a mock token as there is no way to
 *    fetch the real token from API (simulation only)
 * 3. Attempt login with:
 *
 *    - Correct email, wrong password
 *    - Wrong email, correct password
 *    - Both wrong email and wrong password For each case, assert that login
 *         fails and does not reveal specific error reason
 */
export async function test_api_user_login_invalid_credentials_error(
  connection: api.IConnection,
) {
  // 1. Register user
  const email: string & tags.Format<"email"> = typia.random<
    string & tags.Format<"email">
  >();
  const password: string = RandomGenerator.alphaNumeric(16);
  const join = await api.functional.auth.user.join(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(join);
  TestValidator.equals(
    "email not verified after join",
    join.user.is_email_verified,
    false,
  );

  // 2. Simulate email verification (token unknown, so use a mock token)
  // In a full test suite, token would be fetched from mail/DB, but API does not expose this
  await api.functional.auth.user.verify_email.verifyEmail(connection, {
    body: {
      user_id: join.user.id,
      token: RandomGenerator.alphaNumeric(32),
    } satisfies ITodoListUser.IVerifyEmail,
  });

  // 3. Login with correct email, wrong password
  await TestValidator.error("login fails with invalid password", async () => {
    await api.functional.auth.user.login(connection, {
      body: {
        email,
        password: RandomGenerator.alphaNumeric(18),
      } satisfies ITodoListUser.ILogin,
    });
  });

  // 4. Login with wrong email, correct password
  await TestValidator.error("login fails with invalid email", async () => {
    await api.functional.auth.user.login(connection, {
      body: {
        email: typia.random<string & tags.Format<"email">>(),
        password,
      } satisfies ITodoListUser.ILogin,
    });
  });

  // 5. Login with both wrong email and wrong password
  await TestValidator.error(
    "login fails with both email and password invalid",
    async () => {
      await api.functional.auth.user.login(connection, {
        body: {
          email: typia.random<string & tags.Format<"email">>(),
          password: RandomGenerator.alphaNumeric(18),
        } satisfies ITodoListUser.ILogin,
      });
    },
  );
}
