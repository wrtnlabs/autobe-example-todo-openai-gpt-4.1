import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";

/**
 * Minimal E2E test for admin Todo creation in a Todo List application.
 *
 * This test covers only the bare essential scenario:
 *
 * 1. Register a new admin using /auth/admin/join with a unique email/password
 * 2. Use the received admin authentication (token is set by SDK)
 * 3. Create a Todo item via POST /todoList/admin/todos with a valid short title
 * 4. Validate the created Todo has correct fields:
 *
 *    - Id and todo_list_user_id are UUIDs and todo_list_user_id matches admin's id
 *    - Title is as supplied
 *    - Is_completed is false
 *    - Timestamps (created_at, updated_at) are present and valid ISO strings
 *    - Completed_at and deleted_at are null or undefined
 */
export async function test_api_admin_todo_creation_basic(
  connection: api.IConnection,
) {
  // 1. Register a new admin
  const adminEmail: string = typia.random<string & tags.Format<"email">>();
  const adminPassword: string = typia.random<string & tags.MinLength<8>>();

  const admin = await api.functional.auth.admin.join(connection, {
    body: {
      email: adminEmail,
      password: adminPassword,
    } satisfies ITodoListAdmin.ICreate,
  });
  typia.assert(admin);

  // 2. Create a Todo as the authenticated admin
  const todoTitle: string = RandomGenerator.paragraph({
    sentences: 1,
    wordMin: 4,
    wordMax: 10,
  });
  const newTodo = await api.functional.todoList.admin.todos.create(connection, {
    body: {
      title: todoTitle,
    } satisfies ITodoListTodo.ICreate,
  });
  typia.assert(newTodo);

  // 3. Validate created Todo fields
  TestValidator.equals(
    "todo_list_user_id matches admin id",
    newTodo.todo_list_user_id,
    admin.id,
  );
  TestValidator.equals("title matches input", newTodo.title, todoTitle);
  TestValidator.equals("is_completed is false", newTodo.is_completed, false);
  TestValidator.predicate(
    "id, created_at, updated_at are non-empty",
    Boolean(newTodo.id) &&
      Boolean(newTodo.created_at) &&
      Boolean(newTodo.updated_at),
  );
  TestValidator.equals(
    "completed_at is null or undefined",
    newTodo.completed_at,
    null,
  );
  TestValidator.equals(
    "deleted_at is null or undefined",
    newTodo.deleted_at,
    null,
  );
}
