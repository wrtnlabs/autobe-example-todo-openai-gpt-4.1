import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import type { ITodoListDeletedTodoLog } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListDeletedTodoLog";

export async function test_api_deleted_todo_log_detail_not_found_or_not_owned(
  connection: api.IConnection,
) {
  /**
   * Test attempt to retrieve a deleted todo log by its id as a non-owner user
   * to confirm strong user-data isolation.
   *
   * Steps:
   *
   * 1. Register user1
   * 2. User1 creates a todo
   * 3. User1 deletes the todo (producing a deleted log)
   * 4. Register user2 (new email)
   * 5. User2 attempts to fetch user1's deleted todo log by ID
   * 6. Assert that user2 receives a not-found or forbidden error
   */

  // 1. Register user1
  const user1Email = typia.random<string & tags.Format<"email">>();
  const user1Password = RandomGenerator.alphaNumeric(12);
  const user1Auth = await api.functional.auth.user.join(connection, {
    body: {
      email: user1Email,
      password: user1Password,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(user1Auth);
  // 2. user1 creates a todo
  const createdTodo = await api.functional.todoList.user.todos.create(
    connection,
    {
      body: {
        title: RandomGenerator.paragraph({
          sentences: 3,
          wordMin: 5,
          wordMax: 10,
        }),
        description: RandomGenerator.paragraph({ sentences: 5 }),
        due_date: null,
      } satisfies ITodoListTodo.ICreate,
    },
  );
  typia.assert(createdTodo);
  // 3. user1 deletes the todo
  await api.functional.todoList.user.todos.erase(connection, {
    todoId: createdTodo.id,
  });
  // 4. Register user2
  const user2Email = typia.random<string & tags.Format<"email">>();
  const user2Password = RandomGenerator.alphaNumeric(12);
  const user2Auth = await api.functional.auth.user.join(connection, {
    body: {
      email: user2Email,
      password: user2Password,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(user2Auth);
  // 5. user2 attempts to access user1's deleted todo log. If log id is not directly accessible, we are forced to use the deleted todo's id as the audit log id (see domain comments).
  await TestValidator.error(
    "user2 cannot access deleted todo log not owned by themselves",
    async () => {
      await api.functional.todoList.user.deletedTodoLogs.at(connection, {
        deletedTodoLogId: createdTodo.id,
      });
    },
  );
}
