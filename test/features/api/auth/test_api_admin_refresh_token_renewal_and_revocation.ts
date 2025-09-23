import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";

/**
 * Validates admin token refresh, renewal, and secure revocation of refresh
 * tokens.
 *
 * 1. Registers a unique admin
 * 2. Logs in to obtain refresh token
 * 3. Refreshes token using valid refresh token, ensures new credentials
 * 4. Verifies old refresh token cannot be reused
 * 5. Attempts refresh with bogus/expired token and checks secure error
 */
export async function test_api_admin_refresh_token_renewal_and_revocation(
  connection: api.IConnection,
) {
  // 1. Register a new administrator
  const adminEmail = typia.random<string & tags.Format<"email">>();
  const password = RandomGenerator.alphaNumeric(15);
  const password_hash = password; // In real apps this should be pre-hashed for security!
  const joinRes = await api.functional.auth.admin.join(connection, {
    body: {
      email: adminEmail,
      password_hash,
      name: RandomGenerator.name(),
      avatar_uri: null,
      status: "active",
      privilege_level: "support",
    } satisfies ITodoListAdmin.IJoin,
  });
  typia.assert(joinRes);
  TestValidator.equals(
    "joined admin email matches",
    joinRes.admin.email,
    adminEmail,
  );

  // 2. Authenticate admin (get initial refresh token)
  const loginRes = await api.functional.auth.admin.login(connection, {
    body: {
      email: adminEmail,
      password: password,
    } satisfies ITodoListAdmin.ILogin,
  });
  typia.assert(loginRes);
  TestValidator.equals("login email matches", loginRes.admin.email, adminEmail);
  const firstRefreshToken = loginRes.token.refresh;

  // 3. Use the refresh token for session renewal
  const refreshRes = await api.functional.auth.admin.refresh(connection, {
    body: {
      refresh_token: firstRefreshToken,
    } satisfies ITodoListAdmin.IRefresh,
  });
  typia.assert(refreshRes);
  TestValidator.notEquals(
    "refreshed access token differs",
    refreshRes.token.access,
    loginRes.token.access,
  );
  TestValidator.notEquals(
    "refreshed refresh token differs",
    refreshRes.token.refresh,
    firstRefreshToken,
  );

  // 4. Old refresh token cannot be reused
  await TestValidator.error(
    "reusing used/rotated refresh token is rejected",
    async () => {
      await api.functional.auth.admin.refresh(connection, {
        body: {
          refresh_token: firstRefreshToken,
        } satisfies ITodoListAdmin.IRefresh,
      });
    },
  );

  // 5. Submit an obviously invalid refresh token
  await TestValidator.error(
    "refresh with clearly invalid token is rejected",
    async () => {
      await api.functional.auth.admin.refresh(connection, {
        body: {
          refresh_token: RandomGenerator.alphaNumeric(64),
        } satisfies ITodoListAdmin.IRefresh,
      });
    },
  );
}
