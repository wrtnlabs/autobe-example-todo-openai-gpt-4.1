import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Test login with a valid user email but incorrect password.
 *
 * 1. Register a user with a specific email and password
 * 2. Attempt to log in with the same email but a wrong password
 * 3. Validate that the login fails and system returns a generic error (no
 *    credential leakage)
 */
export async function test_api_user_login_with_invalid_password(
  connection: api.IConnection,
) {
  // Step 1: Register a new user with known password
  const userEmail = typia.random<string & tags.Format<"email">>();
  const correctPassword = RandomGenerator.alphaNumeric(12);

  const joinBody = {
    email: userEmail,
    password: correctPassword,
    name: RandomGenerator.name(),
    avatar_uri: null,
  } satisfies ITodoListUser.IJoin;

  const authorized = await api.functional.auth.user.join(connection, {
    body: joinBody,
  });
  typia.assert(authorized);

  // Step 2: Attempt to log in with valid email but incorrect password
  const loginBody = {
    email: userEmail,
    password: correctPassword + "_wrong", // makes it incorrect
  } satisfies ITodoListUser.ILogin;

  // Step 3: Validate that login attempts with wrong password should fail with generic error, not leaking details
  await TestValidator.error(
    "login with valid email but invalid password is rejected",
    async () => {
      await api.functional.auth.user.login(connection, { body: loginBody });
    },
  );
}
