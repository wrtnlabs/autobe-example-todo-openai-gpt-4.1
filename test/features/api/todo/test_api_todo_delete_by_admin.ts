import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";

/**
 * Verifies that an admin can delete any Todo item in the system.
 *
 * 1. Register an admin
 * 2. Admin creates a Todo item
 * 3. Admin deletes the created Todo item
 * 4. Attempt to delete the same Todo item again and check error
 *
 * Business rules:
 *
 * - Admins must have privileged access to create and delete Todo entries
 * - After deletion, the Todo should no longer exist
 */
export async function test_api_todo_delete_by_admin(
  connection: api.IConnection,
) {
  // 1. Register a new admin
  const adminEmail = typia.random<string & tags.Format<"email">>();
  const adminPassword = RandomGenerator.alphaNumeric(12);
  const admin = await api.functional.auth.admin.join(connection, {
    body: {
      email: adminEmail,
      password: adminPassword,
    } satisfies ITodoListAdmin.ICreate,
  });
  typia.assert(admin);

  // 2. Admin creates a new Todo
  const todo = await api.functional.todoList.admin.todos.create(connection, {
    body: {
      title: RandomGenerator.paragraph({ sentences: 3 }),
    } satisfies ITodoListTodo.ICreate,
  });
  typia.assert(todo);

  // 3. Admin deletes the Todo
  await api.functional.todoList.admin.todos.erase(connection, {
    todoId: todo.id,
  });

  // 4. After deletion, further attempts throw errors (negative test)
  await TestValidator.error(
    "deleting already-deleted Todo should fail",
    async () => {
      await api.functional.todoList.admin.todos.erase(connection, {
        todoId: todo.id,
      });
    },
  );
}
