import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import type { ITodoListDeletedTodoLog } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListDeletedTodoLog";

export async function test_api_deleted_todo_log_detail_success(
  connection: api.IConnection,
) {
  /**
   * End-to-end test for retrieving detailed audit snapshot of a deleted todo
   * owned by the authenticated user.
   *
   * Steps:
   *
   * 1. Register a user
   * 2. Create a todo as that user
   * 3. Delete the todo to generate a deleted todo log
   * 4. Retrieve the deleted todo log detail by its ID
   * 5. Validate that the audit snapshot matches expected deletion state
   *
   *    - All snapshot fields correspond to the state at deletion
   *    - Links (IDs, timestamps) are consistent between creation, deletion, and
   *         audit log
   *    - Only accessible for current user
   */

  // 1. Register user
  const userEmail = typia.random<string & tags.Format<"email">>();
  const userPassword = RandomGenerator.alphaNumeric(12);
  const auth = await api.functional.auth.user.join(connection, {
    body: {
      email: userEmail,
      password: userPassword,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(auth);
  const userId = auth.user.id;

  // 2. Create todo as the user
  const todoData = {
    title: RandomGenerator.paragraph({
      sentences: 3,
      wordMin: 4,
      wordMax: 8,
    }) as string & tags.MinLength<1> & tags.MaxLength<255>,
    description: RandomGenerator.paragraph({
      sentences: 5,
      wordMin: 5,
      wordMax: 10,
    }),
    due_date: new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    ).toISOString() as string & tags.Format<"date-time">,
    is_completed: false,
  } satisfies ITodoListTodo.ICreate;
  const todo = await api.functional.todoList.user.todos.create(connection, {
    body: todoData,
  });
  typia.assert(todo);
  TestValidator.equals(
    "created todo - match basic fields",
    todo.title,
    todoData.title,
  );
  TestValidator.equals(
    "created todo - match description",
    todo.description,
    todoData.description,
  );
  TestValidator.equals(
    "created todo - match is_completed default",
    todo.is_completed,
    false,
  );
  TestValidator.equals(
    "created todo - match due_date",
    todo.due_date,
    todoData.due_date,
  );
  const todoId = todo.id;

  // 3. Delete the todo (creates audit log)
  await api.functional.todoList.user.todos.erase(connection, { todoId });
  // There is no response body for erase

  // 4. Retrieve deleted todo log by its ID (should exist for the user)
  // Assumes by business rule that the deleted log id matches the original todo id
  const auditLog = await api.functional.todoList.user.deletedTodoLogs.at(
    connection,
    {
      deletedTodoLogId: todoId,
    },
  );
  typia.assert(auditLog);

  // 5. Validate audit snapshot matches expected deletion state
  TestValidator.equals(
    "deleted log original_todo_id matches todo",
    auditLog.original_todo_id,
    todoId,
  );
  TestValidator.equals(
    "deleted log title matches todo title",
    auditLog.title,
    todo.title,
  );
  TestValidator.equals(
    "deleted log description matches",
    auditLog.description,
    todo.description,
  );
  TestValidator.equals(
    "deleted log due_date matches",
    auditLog.due_date,
    todo.due_date,
  );
  TestValidator.equals(
    "deleted log is_completed matches",
    auditLog.is_completed,
    false,
  );
  TestValidator.equals(
    "deleted log created_at matches",
    auditLog.created_at,
    todo.created_at,
  );
  TestValidator.equals(
    "deleted log updated_at >= todo updated_at",
    auditLog.updated_at >= todo.updated_at,
    true,
  );
  TestValidator.predicate(
    "deleted_at is later than todo created_at",
    () => auditLog.deleted_at > todo.created_at,
  );
  TestValidator.equals(
    "deleted log completed_at matches",
    auditLog.completed_at,
    todo.completed_at,
  );
}
