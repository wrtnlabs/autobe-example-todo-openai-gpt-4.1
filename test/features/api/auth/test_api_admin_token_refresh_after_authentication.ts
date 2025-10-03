import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";

/**
 * Verify admin JWT refresh token lifecycle: registration, initial token
 * issuance, and chained refresh.
 *
 * 1. Register a new admin via /auth/admin/join (provides authorized object with
 *    refresh token).
 * 2. Use the refresh token to perform /auth/admin/refresh, ensuring a new set of
 *    tokens (access, refresh) are issued.
 * 3. Assert new tokens differ from the originals (to confirm effective refresh)
 *    and all expected fields are present.
 * 4. Optionally, attempt to refresh again with new refresh token to confirm
 *    repeatability (JWT session extension).
 * 5. Only success flow will be tested due to API/DTO constraints (error/expiry
 *    simulation not implemented).
 */
export async function test_api_admin_token_refresh_after_authentication(
  connection: api.IConnection,
) {
  // 1. Register a new admin
  const adminInput = {
    email: typia.random<string & tags.Format<"email">>(),
    password: RandomGenerator.alphaNumeric(12), // minLength<8>
  } satisfies ITodoListAdmin.ICreate;
  const admin = await api.functional.auth.admin.join(connection, {
    body: adminInput,
  });
  typia.assert(admin);
  TestValidator.equals("admin email matches", admin.email, adminInput.email);

  // 2. Use refresh token to refresh session
  const refresh1 = await api.functional.auth.admin.refresh(connection, {
    body: {
      refresh_token: admin.token.refresh,
    } satisfies ITodoListAdmin.IRefresh,
  });
  typia.assert(refresh1);
  TestValidator.notEquals(
    "new token differs from original",
    refresh1.token.refresh,
    admin.token.refresh,
  );
  TestValidator.notEquals(
    "new access differs from original",
    refresh1.token.access,
    admin.token.access,
  );
  TestValidator.equals(
    "admin id remains same after refresh",
    refresh1.id,
    admin.id,
  );
  TestValidator.equals(
    "admin email remains same after refresh",
    refresh1.email,
    admin.email,
  );

  // 3. Chain refresh: use new refresh token to obtain fresh tokens again
  const refresh2 = await api.functional.auth.admin.refresh(connection, {
    body: {
      refresh_token: refresh1.token.refresh,
    } satisfies ITodoListAdmin.IRefresh,
  });
  typia.assert(refresh2);
  TestValidator.notEquals(
    "refresh2 token differs from refresh1",
    refresh2.token.refresh,
    refresh1.token.refresh,
  );
  TestValidator.notEquals(
    "refresh2 access differs from refresh1",
    refresh2.token.access,
    refresh1.token.access,
  );
  TestValidator.equals(
    "admin id remains same on chained refresh",
    refresh2.id,
    admin.id,
  );
}
