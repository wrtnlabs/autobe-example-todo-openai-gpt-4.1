import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Validate admin ability to retrieve user detail and error on
 * non-existent/deleted user profile.
 *
 * 1. Register a new admin using /auth/admin/join (with random email/password)
 * 2. Register multiple user accounts using /auth/user/join (at least 2 users,
 *    random email per user)
 * 3. Authenticate as admin with /auth/admin/login
 * 4. As admin, access user detail with /todoList/admin/users/{userId} for one of
 *    the created users
 *
 *    - Validate field content matches the DTO and is non-sensitive (no
 *         password_hash)
 *    - Ensure status/deletion state is as expected, and business/compliance fields
 *         present
 * 5. As admin, access /todoList/admin/users/{userId} with a random UUID (not used
 *    for any user)
 *
 *    - Confirm 'not found' or equivalent error is returned
 * 6. Attempt to retrieve a soft-deleted user's profile by using another random
 *    UUID
 *
 *    - Confirm error is returned (soft-delete simulated since direct deletion API is
 *         unavailable)
 */
export async function test_api_admin_user_detail_access_and_nonexistence(
  connection: api.IConnection,
) {
  // 1. Register an admin
  const adminEmail = `${RandomGenerator.alphaNumeric(8)}@admin.test.com`;
  const adminPassword = RandomGenerator.alphaNumeric(12);
  const adminJoinRes = await api.functional.auth.admin.join(connection, {
    body: {
      email: adminEmail,
      password_hash: adminPassword,
      name: RandomGenerator.name(),
      avatar_uri: null,
      status: "active",
      privilege_level: "support",
    } satisfies ITodoListAdmin.IJoin,
  });
  typia.assert(adminJoinRes);

  // 2. Register two user accounts
  const userInfos = ArrayUtil.repeat(2, () => ({
    email: `${RandomGenerator.alphaNumeric(8)}@user.test.com`,
    password: RandomGenerator.alphaNumeric(12),
    name: RandomGenerator.name(),
    avatar_uri: null,
  }));
  const users = [] as ITodoListUser.IAuthorized[];
  for (const info of userInfos) {
    const userJoin = await api.functional.auth.user.join(connection, {
      body: {
        email: info.email,
        password: info.password,
        name: info.name,
        avatar_uri: info.avatar_uri,
      } satisfies ITodoListUser.IJoin,
    });
    typia.assert(userJoin);
    users.push(userJoin);
  }

  // 3. Authenticate as admin
  const adminLoginRes = await api.functional.auth.admin.login(connection, {
    body: {
      email: adminEmail,
      password: adminPassword,
    } satisfies ITodoListAdmin.ILogin,
  });
  typia.assert(adminLoginRes);

  // 4. Retrieve detail of the first user by userId
  const targetUser = users[0];
  const detail = await api.functional.todoList.admin.users.at(connection, {
    userId: targetUser.id,
  });
  typia.assert(detail);
  TestValidator.equals("user id matches", detail.id, targetUser.id);
  TestValidator.equals(
    "user email matches",
    detail.email,
    targetUser.user.email,
  );
  TestValidator.equals(
    "status is active or present",
    typeof detail.status,
    "string",
  );
  TestValidator.equals(
    "deleted_at is null or undefined",
    detail.deleted_at ?? null,
    null,
  );
  TestValidator.predicate(
    "no sensitive password field",
    !("password_hash" in detail),
  );

  // 5. Attempt lookup for non-existent userId
  const nonExistentUserId = typia.random<string & tags.Format<"uuid">>();
  await TestValidator.error(
    "admin GET non-existent user yields error",
    async () => {
      await api.functional.todoList.admin.users.at(connection, {
        userId: nonExistentUserId,
      });
    },
  );

  // 6. Attempt lookup for a soft-deleted user (simulate by using another random UUID)
  const softDeletedUserId = typia.random<string & tags.Format<"uuid">>();
  await TestValidator.error("GET soft-deleted user yields error", async () => {
    await api.functional.todoList.admin.users.at(connection, {
      userId: softDeletedUserId,
    });
  });
}
