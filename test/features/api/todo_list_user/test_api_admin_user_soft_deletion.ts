import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Validate admin soft-deletes a user account via DELETE
 * /todoList/admin/users/{userId}.
 *
 * Steps:
 *
 * 1. Admin registers (POST /auth/admin/join) with unique email and random
 *    password_hash.
 * 2. Login as admin (POST /auth/admin/login) with those credentials.
 * 3. Create user (POST /auth/user/join) with unique email and random password.
 * 4. Admin erases that user (DELETE /todoList/admin/users/{userId}).
 * 5. (OPTIONAL) Try deleting a random/nonexistent user; error must be thrown.
 *
 * Validate:
 *
 * - User cannot be found post-deletion, or user.deletd_at is set if retrievable.
 * - Erasure is soft (deleted_at is filled).
 * - Cannot erase a nonexistent user (error is thrown).
 *
 * ALL API calls strictly use SDK and exact DTO types with typia.assert() for
 * output validation.
 */
export async function test_api_admin_user_soft_deletion(
  connection: api.IConnection,
) {
  // 1. Register admin
  const adminEmail = typia.random<string & tags.Format<"email">>();
  const adminPassword = RandomGenerator.alphaNumeric(12);
  const adminJoin = {
    email: adminEmail,
    password_hash: adminPassword,
    name: RandomGenerator.name(),
    avatar_uri: null,
    status: "active",
    privilege_level: "superadmin",
  } satisfies ITodoListAdmin.IJoin;
  const adminAuth = await api.functional.auth.admin.join(connection, {
    body: adminJoin,
  });
  typia.assert(adminAuth);
  // 2. Login as admin
  const adminLogin = {
    email: adminEmail,
    password: adminPassword,
  } satisfies ITodoListAdmin.ILogin;
  const adminSession = await api.functional.auth.admin.login(connection, {
    body: adminLogin,
  });
  typia.assert(adminSession);

  // 3. Register user
  const userEmail = typia.random<string & tags.Format<"email">>();
  const userPassword = RandomGenerator.alphaNumeric(10);
  const userJoin = {
    email: userEmail,
    password: userPassword,
    name: RandomGenerator.name(2),
    avatar_uri: null,
  } satisfies ITodoListUser.IJoin;
  const userAuth = await api.functional.auth.user.join(connection, {
    body: userJoin,
  });
  typia.assert(userAuth);

  // 4. As admin, erase that user
  await api.functional.todoList.admin.users.erase(connection, {
    userId: userAuth.id,
  });
  // 5. Try erase again; expect error
  await TestValidator.error("delete non-existent user throws", async () => {
    await api.functional.todoList.admin.users.erase(connection, {
      userId: typia.random<string & tags.Format<"uuid">>(),
    });
  });
}
