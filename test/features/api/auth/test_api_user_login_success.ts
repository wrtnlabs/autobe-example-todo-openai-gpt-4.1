import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Validate the user login authentication flow for the minimal Todo app.
 *
 * This test ensures that a new user can join (register) successfully and then
 * log in immediately using the same credentials. Upon successful login, it
 * asserts that valid JWT access/refresh tokens are issued, the returned
 * structure matches ITodoListUser.IAuthorized, and the account's updated_at
 * timestamp is changed on login (demonstrating last login/update tracking by
 * the backend).
 *
 * Test steps:
 *
 * 1. Register a new user account with random email/password
 * 2. Attempt login with the same credentials
 * 3. Assert tokens are present and valid structure
 * 4. Assert 'updated_at' has changed between registration and login, confirming
 *    login is tracked
 */
export async function test_api_user_login_success(connection: api.IConnection) {
  // 1. Register a new user account
  const joinInput = typia.random<ITodoListUser.IJoin>();
  const joinResult: ITodoListUser.IAuthorized =
    await api.functional.auth.user.join(connection, { body: joinInput });
  typia.assert(joinResult);
  // 2. Login with same credentials
  const loginResult: ITodoListUser.IAuthorized =
    await api.functional.auth.user.login(connection, { body: joinInput });
  typia.assert(loginResult);
  // 3. Assert tokens and structure
  TestValidator.predicate(
    "access token present",
    typeof loginResult.token.access === "string" &&
      loginResult.token.access.length > 0,
  );
  TestValidator.predicate(
    "refresh token present",
    typeof loginResult.token.refresh === "string" &&
      loginResult.token.refresh.length > 0,
  );
  typia.assert<IAuthorizationToken>(loginResult.token);
  // 4. Assert updated_at is changed between join and login
  TestValidator.notEquals(
    "updated_at changed after login",
    loginResult.updated_at,
    joinResult.updated_at,
  );
  // 5. Assert core user fields did not change
  TestValidator.equals("user id stable", loginResult.id, joinResult.id);
  TestValidator.equals(
    "user email stable",
    loginResult.email,
    joinResult.email,
  );
}
