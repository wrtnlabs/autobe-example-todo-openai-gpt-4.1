import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";

/**
 * Validates the workflow of an admin deleting another admin account.
 *
 * 1. Register admin A and admin B with unique random emails and strong passwords.
 * 2. Log in as admin A to set the context for admin-privileged actions.
 * 3. Use admin A's privileges to delete admin B via DELETE
 *    /todoList/admin/admins/{adminId}.
 * 4. Assert that deletion is successful (no error thrown, void response).
 * 5. Validate that subsequent attempt to delete B again fails (error for
 *    non-existent admin).
 */
export async function test_api_admin_deletion_by_admin_success(
  connection: api.IConnection,
) {
  // Register admin A
  const adminA_email = typia.random<string & tags.Format<"email">>();
  const adminA_password = RandomGenerator.alphaNumeric(12);
  const adminA_join = await api.functional.auth.admin.join(connection, {
    body: {
      email: adminA_email,
      password_hash: adminA_password,
      name: RandomGenerator.name(),
      status: "active",
      privilege_level: "superadmin",
    } satisfies ITodoListAdmin.IJoin,
  });
  typia.assert(adminA_join);

  // Register admin B
  const adminB_email = typia.random<string & tags.Format<"email">>();
  const adminB_password = RandomGenerator.alphaNumeric(12);
  const adminB_join = await api.functional.auth.admin.join(connection, {
    body: {
      email: adminB_email,
      password_hash: adminB_password,
      name: RandomGenerator.name(),
      status: "active",
      privilege_level: "support",
    } satisfies ITodoListAdmin.IJoin,
  });
  typia.assert(adminB_join);

  // Authenticate as admin A
  const adminA_login = await api.functional.auth.admin.login(connection, {
    body: {
      email: adminA_email,
      password: adminA_password,
    } satisfies ITodoListAdmin.ILogin,
  });
  typia.assert(adminA_login);

  // Delete admin B as admin A
  await api.functional.todoList.admin.admins.erase(connection, {
    adminId: adminB_join.admin.id,
  });

  // After deletion, attempting to delete again should fail (admin B not found)
  await TestValidator.error("deleting non-existent admin fails", async () => {
    await api.functional.todoList.admin.admins.erase(connection, {
      adminId: adminB_join.admin.id,
    });
  });
}
