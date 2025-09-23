import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";

/**
 * Admin profile update workflow: This test verifies that when admin A is
 * authenticated, they can update another admin B's profile fields—including
 * name, privilege_level, and status—using PUT /todoList/admin/admins/{adminId}.
 * The workflow covers registration of both admins, login as admin A, profile
 * update for admin B, and validation that only the specified fields have
 * changed while protected fields remain untouched.
 *
 * Step-by-step process:
 *
 * 1. Register admin A and record join info.
 * 2. Register admin B and record join info.
 * 3. Login as admin A using their join credentials.
 * 4. Prepare a profile update for admin B: select random/fresh values for name,
 *    privilege_level, and status; do not touch email.
 * 5. Issue the update as admin A and check the response.
 * 6. Validate: name, privilege_level, and status must match what was set; email is
 *    unchanged; response includes no sensitive credential data such as
 *    password_hash.
 */
export async function test_api_admin_profile_update_success(
  connection: api.IConnection,
) {
  // 1. Register admin A
  const adminAEmail = typia.random<string & tags.Format<"email">>();
  const adminAPassword = RandomGenerator.alphaNumeric(12);
  const adminAName = RandomGenerator.name();
  const adminARegister = await api.functional.auth.admin.join(connection, {
    body: {
      email: adminAEmail,
      password_hash: adminAPassword,
      name: adminAName,
      privilege_level: "superadmin",
      status: "active",
    } satisfies ITodoListAdmin.IJoin,
  });
  typia.assert(adminARegister);
  const adminA = adminARegister.admin;

  // 2. Register admin B
  const adminBEmail = typia.random<string & tags.Format<"email">>();
  const adminBPassword = RandomGenerator.alphaNumeric(12);
  const adminBName = RandomGenerator.name();
  const adminBRegister = await api.functional.auth.admin.join(connection, {
    body: {
      email: adminBEmail,
      password_hash: adminBPassword,
      name: adminBName,
      privilege_level: "support",
      status: "active",
    } satisfies ITodoListAdmin.IJoin,
  });
  typia.assert(adminBRegister);
  const adminB = adminBRegister.admin;

  // 3. Login as admin A
  const adminALogin = await api.functional.auth.admin.login(connection, {
    body: {
      email: adminAEmail,
      password: adminAPassword,
    } satisfies ITodoListAdmin.ILogin,
  });
  typia.assert(adminALogin);
  TestValidator.equals(
    "authenticated admin id equals adminA.id",
    adminALogin.id,
    adminA.id,
  );

  // 4. Prepare updated values for admin B's profile
  const updatedName = RandomGenerator.name();
  const updatedPrivilege = RandomGenerator.pick([
    "support",
    "superadmin",
    "auditor",
  ] as const);
  const updatedStatus = RandomGenerator.pick([
    "active",
    "locked",
    "disabled",
    "suspended",
  ] as const);
  const updateBody = {
    name: updatedName,
    privilege_level: updatedPrivilege,
    status: updatedStatus,
  } satisfies ITodoListAdmin.IUpdate;

  // 5. Execute update as admin A on admin B
  const updated = await api.functional.todoList.admin.admins.update(
    connection,
    {
      adminId: adminB.id,
      body: updateBody,
    },
  );
  typia.assert(updated);

  // 6. Validate update result
  TestValidator.equals("admin id is unchanged", updated.id, adminB.id);
  TestValidator.equals("admin email is unchanged", updated.email, adminB.email);
  TestValidator.equals("admin name updated", updated.name, updatedName);
  TestValidator.equals(
    "admin privilege_level updated",
    updated.privilege_level,
    updatedPrivilege,
  );
  TestValidator.equals("admin status updated", updated.status, updatedStatus);
  TestValidator.notEquals("name actually changed", updated.name, adminB.name);
  TestValidator.notEquals(
    "privilege_level actually changed",
    updated.privilege_level,
    adminB.privilege_level,
  );
  TestValidator.notEquals(
    "status actually changed",
    updated.status,
    adminB.status,
  );

  // Sensitive field is never exposed
  TestValidator.predicate(
    "password_hash not present in response",
    typeof (updated as any).password_hash === "undefined",
  );
}
