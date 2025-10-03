import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Validate that authentication refresh fails with an invalid (tampered) refresh
 * token.
 *
 * 1. Register a new user via /auth/user/join.
 * 2. Log in with the new user credentials via /auth/user/login to receive a valid
 *    refresh token.
 * 3. Modify the refresh token so it becomes clearly invalid (e.g., drop several
 *    characters or append garbage).
 * 4. Attempt to refresh with the invalid refresh token via /auth/user/refresh.
 * 5. Assert that the refresh attempt fails (i.e., error is thrown and no new
 *    tokens are issued).
 */
export async function test_api_user_token_refresh_invalid_token(
  connection: api.IConnection,
) {
  // 1. Register a new user
  const email = `${RandomGenerator.alphabets(8)}@test.com`;
  const password = RandomGenerator.alphaNumeric(12);
  const userAuth = await api.functional.auth.user.join(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(userAuth);

  // 2. Log in with the new user credentials
  const loginAuth = await api.functional.auth.user.login(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListUser.ILogin,
  });
  typia.assert(loginAuth);
  const refreshToken = loginAuth.token.refresh;

  // 3. Modify the refresh token
  const invalidRefreshToken =
    refreshToken.slice(0, Math.floor(refreshToken.length / 2)) + "_INVALID";

  // 4. Attempt to refresh with the invalid token. Should fail.
  await TestValidator.error(
    "refresh with invalid refresh token triggers auth failure",
    async () => {
      await api.functional.auth.user.refresh(connection, {
        body: {
          refresh_token: invalidRefreshToken,
        } satisfies ITodoListUser.IRefresh,
      });
    },
  );
}
