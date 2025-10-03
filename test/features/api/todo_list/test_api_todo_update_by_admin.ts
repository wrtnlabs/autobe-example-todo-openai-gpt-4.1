import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";

/**
 * Validate that an admin can update any Todo item, changing both the title and
 * completion status.
 *
 * 1. Register new admin
 * 2. Create a Todo as admin
 * 3. Update the Todo by changing both its title and is_completed status
 * 4. Validate update result: title and is_completed have changed, schema
 *    constraints are preserved.
 */
export async function test_api_todo_update_by_admin(
  connection: api.IConnection,
) {
  // 1. Register new admin
  const adminEmail = typia.random<string & tags.Format<"email">>();
  const adminPassword = typia.random<string & tags.MinLength<8>>();
  const adminAuth: ITodoListAdmin.IAuthorized =
    await api.functional.auth.admin.join(connection, {
      body: {
        email: adminEmail,
        password: adminPassword,
      } satisfies ITodoListAdmin.ICreate,
    });
  typia.assert(adminAuth);

  // 2. Create a Todo as admin
  const createTitle = RandomGenerator.paragraph({
    sentences: 3,
    wordMin: 2,
    wordMax: 10,
  });
  const createdTodo: ITodoListTodo =
    await api.functional.todoList.admin.todos.create(connection, {
      body: {
        title: createTitle,
      } satisfies ITodoListTodo.ICreate,
    });
  typia.assert(createdTodo);

  // 3. Update the Todo by changing both its title and is_completed status
  const updateTitle = RandomGenerator.paragraph({
    sentences: 4,
    wordMin: 2,
    wordMax: 10,
  });
  const updatedTodo: ITodoListTodo =
    await api.functional.todoList.admin.todos.update(connection, {
      todoId: createdTodo.id,
      body: {
        title: updateTitle,
        is_completed: true,
      } satisfies ITodoListTodo.IUpdate,
    });
  typia.assert(updatedTodo);

  // 4. Validate update result: title and is_completed have changed, schema constraints are preserved.
  TestValidator.equals("updated title applied", updatedTodo.title, updateTitle);
  TestValidator.equals(
    "updated is_completed is true",
    updatedTodo.is_completed,
    true,
  );
  TestValidator.notEquals(
    "updated_at changed after update",
    updatedTodo.updated_at,
    createdTodo.updated_at,
  );
  TestValidator.predicate(
    "title max length enforced",
    updatedTodo.title.length <= 100,
  );
  TestValidator.predicate(
    "created_at not changed after update",
    updatedTodo.created_at === createdTodo.created_at,
  );
  TestValidator.predicate(
    "admin can modify any Todo",
    updatedTodo.todo_list_user_id === createdTodo.todo_list_user_id,
  );
}
