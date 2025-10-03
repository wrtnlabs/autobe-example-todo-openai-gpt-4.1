import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";

/**
 * Validate permanent admin account deletion in the Todo list minimal API.
 *
 * This test covers the full workflow of registering a new admin, creating a
 * Todo as admin, deleting the admin, and confirming that access is revoked.
 *
 * Steps:
 *
 * 1. Register a new admin (generate a unique email and a valid strong password).
 * 2. On successful join, obtain the IAuthorized payload and extract the adminId.
 * 3. As the authenticated admin, create a Todo (minimal required: random valid
 *    title).
 * 4. Call the erase endpoint to delete the admin (using adminId).
 * 5. Try creating another Todo as the deleted admin, expect failure
 *    (TestValidator.error must confirm the account is gone and can't be used).
 */
export async function test_api_admin_delete_account_success(
  connection: api.IConnection,
) {
  // 1. Register a new admin
  const adminCreateBody = {
    email: typia.random<string & tags.Format<"email">>(),
    password: RandomGenerator.alphaNumeric(12),
  } satisfies ITodoListAdmin.ICreate;
  const adminAuth = await api.functional.auth.admin.join(connection, {
    body: adminCreateBody,
  });
  typia.assert(adminAuth);

  // 2. Extract adminId for deletion
  const adminId = adminAuth.id;

  // 3. Create a Todo as the admin
  const todo = await api.functional.todoList.admin.todos.create(connection, {
    body: {
      title: RandomGenerator.paragraph({
        sentences: 3,
        wordMin: 3,
        wordMax: 10,
      }),
    } satisfies ITodoListTodo.ICreate,
  });
  typia.assert(todo);
  TestValidator.equals(
    "Todo is owned by admin",
    todo.todo_list_user_id,
    adminId,
  );

  // 4. Delete the admin
  await api.functional.todoList.admin.admins.erase(connection, {
    adminId,
  });

  // 5. Further operations with this admin (now deleted) must fail
  await TestValidator.error(
    "Deleted admin cannot create Todo anymore",
    async () => {
      await api.functional.todoList.admin.todos.create(connection, {
        body: {
          title: RandomGenerator.paragraph({
            sentences: 3,
            wordMin: 3,
            wordMax: 10,
          }),
        } satisfies ITodoListTodo.ICreate,
      });
    },
  );
}
