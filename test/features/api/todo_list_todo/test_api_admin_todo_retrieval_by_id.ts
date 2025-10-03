import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";

/**
 * Validate admin can retrieve their own created Todo item by id.
 *
 * 1. Register a new admin by calling api.functional.auth.admin.join with a unique,
 *    valid email and strong password (randomized each run).
 * 2. Create a Todo as that admin, using api.functional.todoList.admin.todos.create
 *    (provide valid random title).
 * 3. Retrieve the Todo by id using api.functional.todoList.admin.todos.at (the id
 *    from step 2).
 * 4. Assert via TestValidator.equals that key fields match: id, title, created_at,
 *    is_completed, updated_at, todo_list_user_id. Confirm ownership is the
 *    current admin user id and is_completed is false upon creation. Validate
 *    all types/objects with typia.assert. The test ends here, as deletion or
 *    update is not in scope.
 */
export async function test_api_admin_todo_retrieval_by_id(
  connection: api.IConnection,
) {
  // 1. Register a new admin (unique email and strong password)
  const adminEmail = typia.random<string & tags.Format<"email">>();
  const adminPassword = RandomGenerator.alphaNumeric(12);
  const admin = await api.functional.auth.admin.join(connection, {
    body: {
      email: adminEmail,
      password: adminPassword,
    } satisfies ITodoListAdmin.ICreate,
  });
  typia.assert(admin);

  // 2. Create a Todo item as this admin
  const todoTitle = RandomGenerator.paragraph({
    sentences: 3,
    wordMin: 4,
    wordMax: 10,
  });
  const createdTodo = await api.functional.todoList.admin.todos.create(
    connection,
    {
      body: { title: todoTitle } satisfies ITodoListTodo.ICreate,
    },
  );
  typia.assert(createdTodo);

  // 3. Retrieve the Todo by id
  const retrievedTodo = await api.functional.todoList.admin.todos.at(
    connection,
    {
      todoId: createdTodo.id,
    },
  );
  typia.assert(retrievedTodo);

  // 4. Assert essential fields
  TestValidator.equals(
    "retrieved id matches created",
    retrievedTodo.id,
    createdTodo.id,
  );
  TestValidator.equals(
    "retrieved title matches",
    retrievedTodo.title,
    createdTodo.title,
  );
  TestValidator.equals(
    "retrieved user id matches admin id",
    retrievedTodo.todo_list_user_id,
    admin.id,
  );
  TestValidator.equals(
    "is_completed is false on creation",
    retrievedTodo.is_completed,
    false,
  );
  // Assert created_at/updated_at equality via string comparison
  TestValidator.equals(
    "created_at matches",
    retrievedTodo.created_at,
    createdTodo.created_at,
  );
  TestValidator.equals(
    "updated_at matches",
    retrievedTodo.updated_at,
    createdTodo.updated_at,
  );
  // Optionally, confirm completed_at and deleted_at are missing or null
  TestValidator.equals(
    "completed_at is null on creation",
    retrievedTodo.completed_at,
    null,
  );
  TestValidator.equals(
    "deleted_at is null on creation",
    retrievedTodo.deleted_at,
    null,
  );
}
