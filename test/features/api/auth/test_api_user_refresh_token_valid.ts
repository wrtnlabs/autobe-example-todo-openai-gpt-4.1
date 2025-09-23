import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Validates the refresh token workflow for an authenticated user.
 *
 * 1. Register a new user via the join endpoint using random valid credentials.
 * 2. Log in as the user to obtain a valid refresh token.
 * 3. Use the refresh token to call /auth/user/refresh and obtain new tokens.
 * 4. Assert that the returned data conforms to ITodoListUser.IAuthorized, tokens
 *    are valid and not the same as before, and the user account remains active
 *    and unchanged.
 *
 * Ensures the refresh endpoint works according to contract and tokens rotate as
 * expected.
 */
export async function test_api_user_refresh_token_valid(
  connection: api.IConnection,
) {
  // Step 1: Register user
  const joinBody = {
    email: typia.random<string & tags.Format<"email">>(),
    password: RandomGenerator.alphaNumeric(12),
    name: RandomGenerator.name(),
    avatar_uri: null as string | null | undefined,
  } satisfies ITodoListUser.IJoin;

  const joined = await api.functional.auth.user.join(connection, {
    body: joinBody,
  });
  typia.assert(joined);

  // Step 2: Log in to obtain refresh token
  const loginBody = {
    email: joinBody.email,
    password: joinBody.password,
  } satisfies ITodoListUser.ILogin;

  const loginResult = await api.functional.auth.user.login(connection, {
    body: loginBody,
  });
  typia.assert(loginResult);
  TestValidator.equals(
    "login user id matches joined user",
    loginResult.id,
    joined.id,
  );
  TestValidator.equals(
    "login user email matches",
    loginResult.user.email,
    joinBody.email,
  );
  TestValidator.equals(
    "login status active",
    loginResult.user.status,
    "active",
  );

  // Step 3: Call refresh endpoint with refresh_token
  const refreshBody = {
    refresh_token: loginResult.token.refresh,
  } satisfies ITodoListUser.IRefresh;
  const refreshResult = await api.functional.auth.user.refresh(connection, {
    body: refreshBody,
  });
  typia.assert(refreshResult);
  // Step 4: Validate new tokens and user info
  TestValidator.equals(
    "refresh user id matches login id",
    refreshResult.id,
    loginResult.id,
  );
  TestValidator.equals(
    "refresh user email matches",
    refreshResult.user.email,
    loginResult.user.email,
  );
  TestValidator.equals(
    "refresh status active",
    refreshResult.user.status,
    "active",
  );
  TestValidator.notEquals(
    "access token must change on refresh",
    refreshResult.token.access,
    loginResult.token.access,
  );
  TestValidator.notEquals(
    "refresh token must change on refresh",
    refreshResult.token.refresh,
    loginResult.token.refresh,
  );
  TestValidator.predicate(
    "refreshed tokens not null",
    !!refreshResult.token.access && !!refreshResult.token.refresh,
  );
}
