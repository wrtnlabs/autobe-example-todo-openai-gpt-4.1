import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";

/**
 * Validate admin login and authentication contract.
 *
 * This test will:
 *
 * 1. Register a new admin via POST /auth/admin/join using a unique email and
 *    strong password.
 * 2. Attempt login via POST /auth/admin/login with the same credentials, expecting
 *    a successful response matching ITodoListAdmin.IAuthorized (id, email,
 *    created_at, updated_at, token only).
 * 3. Validate the .token prop is present and matches IAuthorizationToken.
 * 4. Confirm that extra user fields (e.g. password, password_hash) are not
 *    returned.
 * 5. Attempt login with the same email but invalid password, expecting an error.
 *
 * This ensures the essential admin authentication workflow is correct and
 * contract is not leaky.
 */
export async function test_api_admin_login_existing(
  connection: api.IConnection,
) {
  // Prepare unique admin credentials
  const email = typia.random<string & tags.Format<"email">>();
  const password = RandomGenerator.alphaNumeric(12); // Strong password

  // 1. Register new admin
  const joinAdmin = await api.functional.auth.admin.join(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListAdmin.ICreate,
  });
  typia.assert(joinAdmin);
  TestValidator.equals(
    "joined admin email matches input",
    joinAdmin.email,
    email,
  );

  // 2. Login with correct credentials
  const loginResp = await api.functional.auth.admin.login(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListAdmin.ILogin,
  });
  typia.assert(loginResp);
  TestValidator.equals("login email matches input", loginResp.email, email);
  TestValidator.equals("login id remains the same", loginResp.id, joinAdmin.id);
  TestValidator.equals("token is present", typeof loginResp.token, "object");
  typia.assert(loginResp.token);
  // Ensure sensitive fields are not present
  TestValidator.predicate(
    "response has only expected fields",
    () =>
      Object.keys(loginResp).sort().join(",") ===
      ["created_at", "email", "id", "token", "updated_at"].sort().join(","),
  );
  // Ensure token has expected fields
  TestValidator.predicate(
    "token has only expected fields",
    () =>
      Object.keys(loginResp.token).sort().join(",") ===
      ["access", "expired_at", "refresh", "refreshable_until"].sort().join(","),
  );

  // 3. Login with invalid password
  await TestValidator.error("login fails with wrong password", async () => {
    await api.functional.auth.admin.login(connection, {
      body: {
        email,
        password: password + "wrong", // Invalid
      } satisfies ITodoListAdmin.ILogin,
    });
  });
}
