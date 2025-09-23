import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Tests the login process for an existing user with correct email and password.
 *
 * 1. Register a new user with random email and password.
 * 2. Log in with the same credentials.
 * 3. Validate that login succeeds and the returned tokens are well-formed.
 * 4. Ensure the user id is the same in both join and login responses.
 * 5. Assert last_login_at is present, non-null, and correctly formatted in login
 *    response.
 * 6. Check that a new access token is issued after login (tokens differ).
 */
export async function test_api_user_login_with_valid_credentials(
  connection: api.IConnection,
) {
  // 1. Prepare unique credentials for a test user
  const email = typia.random<string & tags.Format<"email">>();
  const password = typia.random<string>();
  const name = RandomGenerator.name();

  // 2. Register a user
  const joinResp = await api.functional.auth.user.join(connection, {
    body: {
      email,
      password,
      name,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(joinResp);

  // 3. Login with those credentials
  const loginResp = await api.functional.auth.user.login(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListUser.ILogin,
  });
  typia.assert(loginResp);

  // 4. Validate session token structure
  typia.assert<IAuthorizationToken>(loginResp.token);
  TestValidator.predicate(
    "login access token is non-empty string",
    typeof loginResp.token.access === "string" &&
      loginResp.token.access.length > 0,
  );
  TestValidator.predicate(
    "login refresh token is non-empty string",
    typeof loginResp.token.refresh === "string" &&
      loginResp.token.refresh.length > 0,
  );

  // 5. User ID must be identical for both join and login
  TestValidator.equals(
    "user id matches between join and login",
    loginResp.user.id,
    joinResp.user.id,
  );
  typia.assert<ITodoListUser>(loginResp.user);
  TestValidator.predicate(
    "last_login_at is present and non-null",
    !!loginResp.user.last_login_at,
  );
  TestValidator.predicate(
    "last_login_at is valid ISO date-time",
    typeof loginResp.user.last_login_at === "string" &&
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(loginResp.user.last_login_at!),
  );

  // 6. Confirm new JWT access token is issued after login
  TestValidator.notEquals(
    "JWT access tokens should differ after join and login",
    loginResp.token.access,
    joinResp.token.access,
  );
}
