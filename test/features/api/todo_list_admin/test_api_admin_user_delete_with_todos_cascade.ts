import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";

/**
 * Test that an admin can delete a user and trigger the cascading removal of all
 * their associated todos.
 *
 * Steps:
 *
 * 1. Register a new admin account to receive authentication tokens (using
 *    api.functional.auth.admin.join).
 * 2. Create a random userId (UUID) representing a user to be deleted (since user
 *    creation is outside the exposed API/DTO scope).
 * 3. As the authenticated admin, call the erase endpoint:
 *    api.functional.todoList.admin.users.erase({ userId }).
 * 4. Validate the operation completes without error. Since there are no
 *    endpoints/DTOs provided to validate user or todo existence, test will
 *    focus on authentication and endpoint flow.
 */
export async function test_api_admin_user_delete_with_todos_cascade(
  connection: api.IConnection,
) {
  // 1. Register admin
  const adminEmail = typia.random<string & tags.Format<"email">>();
  const adminPassword = typia.random<string & tags.MinLength<8>>();
  const adminAuth = await api.functional.auth.admin.join(connection, {
    body: {
      email: adminEmail,
      password: adminPassword,
    } satisfies ITodoListAdmin.ICreate,
  });
  typia.assert(adminAuth);

  // 2. Prepare a userId (UUID) for deletion
  const userId = typia.random<string & tags.Format<"uuid">>();

  // 3. As admin, delete the user
  await api.functional.todoList.admin.users.erase(connection, { userId });

  // 4. The absence of errors is the primary check due to limited API/DTO exposure
}
