import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import type { ITodoListDeletedTodoLog } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListDeletedTodoLog";

export async function test_api_deleted_todo_log_view_not_found_or_not_owned(
  connection: api.IConnection,
) {
  /**
   * Test strict ownership isolation in retrieval of deleted todo logs.
   *
   * Workflow:
   *
   * 1. Register user1.
   * 2. Under user1: create a todo, then delete it (generating a deleted log).
   * 3. Register user2 (auth context now reflects user2).
   * 4. Under user2: attempt to retrieve user1's deleted todo log using the todo's
   *    id as the deleted log id. This must result in a not-found or forbidden
   *    error, confirming strong audit/data isolation by user context.
   *
   * Note: Since there is no API to enumerate or search deleted logs and the
   * deleted log id is not directly exposed, we pragmatically test using the
   * todo's id as the assumed deleted log id, following e2e limitations and
   * available DTO correlation.
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
  const user1Id = user1Auth.user.id;

  // 2. Under user1, create a todo
  const todo = await api.functional.todoList.user.todos.create(connection, {
    body: {
      title: RandomGenerator.paragraph({
        sentences: 3,
        wordMin: 5,
        wordMax: 10,
      }),
      description: RandomGenerator.paragraph({
        sentences: 8,
        wordMin: 4,
        wordMax: 12,
      }),
    } satisfies ITodoListTodo.ICreate,
  });
  typia.assert(todo);
  const todoId = todo.id;

  // 3. Delete todo (user1)
  await api.functional.todoList.user.todos.erase(connection, { todoId });

  // 4. Register user2 – switches authentication context
  const user2Email = typia.random<string & tags.Format<"email">>();
  const user2Password = RandomGenerator.alphaNumeric(12);
  await api.functional.auth.user.join(connection, {
    body: {
      email: user2Email,
      password: user2Password,
    } satisfies ITodoListUser.IJoin,
  });

  // 5. Attempt: user2 tries to fetch user1's deleted log (assume log id == todoId)
  await TestValidator.error(
    "user2 cannot access user1's deleted todo log",
    async () => {
      await api.functional.todoList.user.todos.deleted.at(connection, {
        deletedTodoLogId: todoId,
      });
    },
  );
}
