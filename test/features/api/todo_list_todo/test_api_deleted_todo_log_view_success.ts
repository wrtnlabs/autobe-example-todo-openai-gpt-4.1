import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import type { ITodoListDeletedTodoLog } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListDeletedTodoLog";

export async function test_api_deleted_todo_log_view_success(
  connection: api.IConnection,
) {
  /**
   * Test successful retrieval of a deleted todo record owned by the
   * authenticated user.
   *
   * This test covers the business workflow of registering a new user, creating
   * a todo, deleting it to generate an audit log, and verifying successful
   * retrieval and correspondence of that log.
   *
   * Steps:
   *
   * 1. Register a new user (implicit authentication)
   * 2. Create a todo for this user
   * 3. Delete the created todo
   * 4. Retrieve the deleted todo log by its ID
   * 5. Assert that all business-relevant fields in the log match the todo's prior
   *    state
   *
   * This scenario demonstrates transparent auditability and self-service
   * history validation for the user.
   */

  // Step 1: Register a new user and authenticate
  const email: string = `${RandomGenerator.alphabets(8)}@example.com`;
  const password: string = RandomGenerator.alphaNumeric(12);
  const joinResult = await api.functional.auth.user.join(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(joinResult);

  // Step 2: Create a todo item
  const todoInput: ITodoListTodo.ICreate = {
    title: RandomGenerator.paragraph({ sentences: 3 }),
    description: RandomGenerator.paragraph({ sentences: 8 }),
    due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    is_completed: false,
  };
  const todo = await api.functional.todoList.user.todos.create(connection, {
    body: todoInput,
  });
  typia.assert(todo);

  // Step 3: Delete the todo to record an audit log
  await api.functional.todoList.user.todos.erase(connection, {
    todoId: todo.id,
  });

  // Step 4: Retrieve the deleted todo log using its ID (usually matches todoId)
  const deletedLog = await api.functional.todoList.user.todos.deleted.at(
    connection,
    {
      deletedTodoLogId: todo.id,
    },
  );
  typia.assert(deletedLog);

  // Step 5: Validate that each log property matches the todo's state at deletion
  TestValidator.equals(
    "deleted log original_todo_id matches deleted todoId",
    deletedLog.original_todo_id,
    todo.id,
  );
  TestValidator.equals(
    "deleted log title mirrors todo title",
    deletedLog.title,
    todo.title,
  );
  TestValidator.equals(
    "deleted log description mirrors todo description",
    deletedLog.description,
    todo.description,
  );
  TestValidator.equals(
    "deleted log due_date mirrors todo due_date",
    deletedLog.due_date,
    todo.due_date,
  );
  TestValidator.equals(
    "deleted log is_completed mirrors todo is_completed",
    deletedLog.is_completed,
    todo.is_completed,
  );
  TestValidator.equals(
    "deleted log completed_at mirrors todo completed_at",
    deletedLog.completed_at,
    todo.completed_at,
  );
  TestValidator.equals(
    "deleted log created_at mirrors todo created_at",
    deletedLog.created_at,
    todo.created_at,
  );
  TestValidator.equals(
    "deleted log updated_at mirrors todo updated_at",
    deletedLog.updated_at,
    todo.updated_at,
  );
  TestValidator.predicate(
    "deleted log deletion timestamp is after todo creation",
    new Date(deletedLog.deleted_at).getTime() >=
      new Date(todo.created_at).getTime(),
  );
}
