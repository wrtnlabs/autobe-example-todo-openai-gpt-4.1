import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";

/**
 * Validates administrator login API for both success and failure scenarios.
 *
 * 1. Registers a new admin with a random email and a known password hash
 * 2. Attempts login with correct credentials; verifies tokens and profile match
 * 3. Attempts login with correct email but incorrect password; expects an error
 */
export async function test_api_admin_login_success_and_failure(
  connection: api.IConnection,
) {
  // 1. Register an administrator
  const adminEmail = typia.random<string & tags.Format<"email">>();
  const knownPassword = "StrongPassword1234!";
  const joinBody = {
    email: adminEmail,
    password_hash: knownPassword,
    name: RandomGenerator.name(),
    status: "active",
    privilege_level: "superadmin",
  } satisfies ITodoListAdmin.IJoin;
  const adminJoinResult = await api.functional.auth.admin.join(connection, {
    body: joinBody,
  });
  typia.assert(adminJoinResult);
  TestValidator.equals(
    "joined admin email same as input",
    adminJoinResult.admin.email,
    adminEmail,
  );
  TestValidator.equals(
    "admin status is active",
    adminJoinResult.admin.status,
    "active",
  );
  TestValidator.equals(
    "admin privilege is superadmin",
    adminJoinResult.admin.privilege_level,
    "superadmin",
  );

  // 2. Login with correct credentials
  const loginBody = {
    email: adminEmail,
    password: knownPassword,
  } satisfies ITodoListAdmin.ILogin;
  const loginResult = await api.functional.auth.admin.login(connection, {
    body: loginBody,
  });
  typia.assert(loginResult);
  TestValidator.equals(
    "login admin id matches joined",
    loginResult.admin.id,
    adminJoinResult.admin.id,
  );
  TestValidator.equals(
    "login admin email matches",
    loginResult.admin.email,
    adminEmail,
  );
  TestValidator.predicate(
    "token access exists",
    typeof loginResult.token.access === "string" &&
      loginResult.token.access.length > 0,
  );
  TestValidator.predicate(
    "token refresh exists",
    typeof loginResult.token.refresh === "string" &&
      loginResult.token.refresh.length > 0,
  );

  // 3. Attempt login with wrong password; expect error
  const wrongLoginBody = {
    email: adminEmail,
    password: "Definitel!!WrongPassword987",
  } satisfies ITodoListAdmin.ILogin;
  await TestValidator.error(
    "admin login with wrong password fails",
    async () => {
      await api.functional.auth.admin.login(connection, {
        body: wrongLoginBody,
      });
    },
  );
}
