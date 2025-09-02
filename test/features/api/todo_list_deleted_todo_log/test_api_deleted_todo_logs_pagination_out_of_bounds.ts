import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import type { ITodoListDeletedTodoLog } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListDeletedTodoLog";
import type { IPageITodoListDeletedTodoLog } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListDeletedTodoLog";
import type { IPage } from "@ORGANIZATION/PROJECT-api/lib/structures/IPage";

export async function test_api_deleted_todo_logs_pagination_out_of_bounds(
  connection: api.IConnection,
) {
  /**
   * Test pagination boundary handling for deleted todo logs.
   *
   * This test verifies that requesting a high (out-of-bounds) page number for
   * the user's deleted todo logs does not throw an error and instead returns an
   * empty data array with correct pagination info. It simulates realistic user
   * behavior for browsing audit history, ensuring the endpoint is robust
   * against pagination attempts that exceed available results.
   *
   * Step-by-step:
   *
   * 1. Register a new user (implicit authentication)
   * 2. Create several todo items
   * 3. Delete all created todos to generate deleted log/audit records
   * 4. Request the deleted todo logs with a page number much greater than the
   *    number of records (e.g. page 1000)
   * 5. Assert that data is an empty array, total page info is sensible, and no
   *    errors are thrown
   */
  // 1. Register new user
  const userRegistration = await api.functional.auth.user.join(connection, {
    body: {
      email: typia.random<string & tags.Format<"email">>(),
      password: RandomGenerator.alphaNumeric(12),
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(userRegistration);

  // 2. Create several todos
  const NUM_TODOS = 5;
  const todoList: ITodoListTodo[] = [];
  for (let i = 0; i < NUM_TODOS; ++i) {
    const created = await api.functional.todoList.user.todos.create(
      connection,
      {
        body: {
          title: RandomGenerator.paragraph({
            sentences: 1,
            wordMin: 5,
            wordMax: 15,
          }),
          description: RandomGenerator.paragraph({
            sentences: 2,
            wordMin: 8,
            wordMax: 20,
          }),
          due_date: null,
          is_completed: false,
        } satisfies ITodoListTodo.ICreate,
      },
    );
    typia.assert(created);
    todoList.push(created);
  }

  // 3. Delete all created todos
  for (const todo of todoList) {
    await api.functional.todoList.user.todos.erase(connection, {
      todoId: todo.id,
    });
  }

  // 4. Request a high page number to test pagination bounds
  const output = await api.functional.todoList.user.deletedTodoLogs.index(
    connection,
    {
      body: {
        page: 1000, // Exceeds total pages
        limit: 2, // Use a low limit to maximize page count
      } satisfies ITodoListDeletedTodoLog.IRequest,
    },
  );
  typia.assert(output);

  // 5. Assert: data is an empty array, pagination structure is sound
  TestValidator.predicate(
    "deleted log out-of-bounds returns empty data",
    output.data.length === 0,
  );
  TestValidator.predicate(
    "deleted log out-of-bounds current equals requested and total pages is less",
    output.pagination.current === 1000 && output.pagination.pages < 1000,
  );
  TestValidator.predicate(
    "pagination metadata present",
    typeof output.pagination.limit === "number" &&
      typeof output.pagination.records === "number",
  );
}
