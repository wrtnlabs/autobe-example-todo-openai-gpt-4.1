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

export async function test_api_deleted_todo_logs_index_success(
  connection: api.IConnection,
) {
  /**
   * E2E test for paginated deleted todo log retrieval, filtering, and user
   * scoping validation.
   *
   * This function verifies that the /todoList/user/todos/deleted endpoint
   * returns only the current user's deleted todos, supports search/filter and
   * pagination, properly snapshots all required fields, and is robust to
   * possible foreign log leakage. It also checks filter scenarios that return
   * empty results and validates all pagination metadata for conformance.
   *
   * Test steps:
   *
   * 1. Register and verify main user.
   * 2. Authenticate main user.
   * 3. Register and verify secondary user (used to ensure no data leak).
   * 4. Authenticate secondary user, create and delete one todo.
   * 5. Switch session back to main user.
   * 6. Main user creates N todos, deletes them, confirming logs should result.
   * 7. Request first page of deleted logs, assert all logs map to only main user
   *    todos, and pagination correct.
   * 8. Test search filter (substring of one of main's titles), assert all returned
   *    logs have expected match.
   * 9. Test filter yielding empty results.
   * 10. If possible, test pagination over multi-page result set.
   */

  // 1. Register and verify the main user
  const userEmail = typia.random<string & tags.Format<"email">>();
  const userPassword = RandomGenerator.alphaNumeric(12);
  const join1 = await api.functional.auth.user.join(connection, {
    body: {
      email: userEmail,
      password: userPassword,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(join1);
  const user1 = join1.user;

  // Simulate verification token (in production, retrieve from backend/email handler)
  const verifyToken1 = typia.random<string>();
  await api.functional.auth.user.verify_email.verifyEmail(connection, {
    body: {
      user_id: user1.id,
      token: verifyToken1,
    } satisfies ITodoListUser.IVerifyEmail,
  });

  // 2. Authenticate main user
  const login1 = await api.functional.auth.user.login(connection, {
    body: {
      email: userEmail,
      password: userPassword,
    } satisfies ITodoListUser.ILogin,
  });
  typia.assert(login1);

  // 3. Register/verify a secondary user
  const user2Email = typia.random<string & tags.Format<"email">>();
  const user2Password = RandomGenerator.alphaNumeric(12);
  const join2 = await api.functional.auth.user.join(connection, {
    body: {
      email: user2Email,
      password: user2Password,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(join2);
  const user2 = join2.user;
  const verifyToken2 = typia.random<string>();
  await api.functional.auth.user.verify_email.verifyEmail(connection, {
    body: {
      user_id: user2.id,
      token: verifyToken2,
    } satisfies ITodoListUser.IVerifyEmail,
  });

  // 4. Authenticate as secondary user, create and delete one todo (should never leak into main user's log page)
  await api.functional.auth.user.login(connection, {
    body: {
      email: user2Email,
      password: user2Password,
    } satisfies ITodoListUser.ILogin,
  });
  const foreignTodo = await api.functional.todoList.user.todos.create(
    connection,
    {
      body: {
        title: `ForeignUser-Todo`,
        description: RandomGenerator.paragraph({ sentences: 2 }),
        due_date: typia.random<string & tags.Format<"date-time">>(),
        is_completed: false,
      } satisfies ITodoListTodo.ICreate,
    },
  );
  typia.assert(foreignTodo);
  await api.functional.todoList.user.todos.erase(connection, {
    todoId: foreignTodo.id,
  });

  // 5. Switch back to main user
  await api.functional.auth.user.login(connection, {
    body: {
      email: userEmail,
      password: userPassword,
    } satisfies ITodoListUser.ILogin,
  });

  // 6. Create, then delete, a batch of todos under the main user
  const N = 8;
  const createdTodos: ITodoListTodo[] = [];
  for (let i = 0; i < N; ++i) {
    const todo = await api.functional.todoList.user.todos.create(connection, {
      body: {
        title: `TestDeleted-${i}-${RandomGenerator.alphaNumeric(8)}`,
        description: RandomGenerator.paragraph({ sentences: 3 }),
        due_date: typia.random<string & tags.Format<"date-time">>(),
        is_completed: i % 2 === 0,
      } satisfies ITodoListTodo.ICreate,
    });
    typia.assert(todo);
    createdTodos.push(todo);
  }
  // now delete them
  for (const todo of createdTodos) {
    await api.functional.todoList.user.todos.erase(connection, {
      todoId: todo.id,
    });
  }
  const createdTodoIds = createdTodos.map((t) => t.id);

  // 7. Call deleted logs endpoint (page 1, limit N) and check everything is correct
  const defaultLogs = await api.functional.todoList.user.todos.deleted.index(
    connection,
    {
      body: {
        page: 1,
        limit: N,
      } satisfies ITodoListDeletedTodoLog.IRequest,
    },
  );
  typia.assert(defaultLogs);
  TestValidator.equals(
    "pagination - current page",
    defaultLogs.pagination.current,
    1,
  );
  TestValidator.equals(
    "pagination - limit as requested",
    defaultLogs.pagination.limit,
    N,
  );
  TestValidator.predicate(
    "pagination.pages >= 1",
    defaultLogs.pagination.pages >= 1,
  );
  TestValidator.predicate("logs returned >= N", defaultLogs.data.length >= N);
  for (const log of defaultLogs.data) {
    typia.assert(log);
    // Must not leak foreign user's logs
    TestValidator.predicate(
      "no foreign original_todo_id",
      createdTodoIds.includes(log.original_todo_id),
    );
    TestValidator.predicate(
      "deleted_at is valid ISO date",
      typeof log.deleted_at === "string" && !isNaN(Date.parse(log.deleted_at)),
    );
    TestValidator.predicate(
      "title non-empty",
      typeof log.title === "string" && log.title.length > 0,
    );
    if (log.description !== undefined) {
      TestValidator.predicate(
        "description is string",
        typeof log.description === "string",
      );
    }
    TestValidator.predicate(
      "is_completed is boolean",
      typeof log.is_completed === "boolean",
    );
    if (log.completed_at !== undefined && log.completed_at !== null) {
      TestValidator.predicate(
        "completed_at is valid ISO date",
        typeof log.completed_at === "string" &&
          !isNaN(Date.parse(log.completed_at)),
      );
    }
    if (log.due_date !== undefined && log.due_date !== null) {
      TestValidator.predicate(
        "due_date is valid ISO date",
        typeof log.due_date === "string" && !isNaN(Date.parse(log.due_date)),
      );
    }
    TestValidator.predicate(
      "created_at is valid ISO date",
      typeof log.created_at === "string" && !isNaN(Date.parse(log.created_at)),
    );
    TestValidator.predicate(
      "updated_at is valid ISO date",
      typeof log.updated_at === "string" && !isNaN(Date.parse(log.updated_at)),
    );
  }

  // 8. Search filter - use substring from one created title, check all match
  const matchString = createdTodos[0].title.slice(0, 11);
  const filteredLogs = await api.functional.todoList.user.todos.deleted.index(
    connection,
    {
      body: {
        page: 1,
        limit: 5,
        search: matchString,
      } satisfies ITodoListDeletedTodoLog.IRequest,
    },
  );
  typia.assert(filteredLogs);
  TestValidator.predicate(
    "filtered logs all match search substring",
    filteredLogs.data.every((log) => log.title.includes(matchString)),
  );
  // If N > 5, check next page
  if (defaultLogs.pagination.pages > 1) {
    const nextPage = await api.functional.todoList.user.todos.deleted.index(
      connection,
      {
        body: {
          page: 2,
          limit: N,
        } satisfies ITodoListDeletedTodoLog.IRequest,
      },
    );
    typia.assert(nextPage);
    TestValidator.equals(
      "pagination - next page current",
      nextPage.pagination.current,
      2,
    );
    TestValidator.predicate(
      "no logs from foreign user on next page",
      nextPage.data.every((log) =>
        createdTodoIds.includes(log.original_todo_id),
      ),
    );
  }
  // 9. Negative search filter: string not present in any title
  const failString = "NoSuchStringPresentQWERTY";
  const emptyFiltered = await api.functional.todoList.user.todos.deleted.index(
    connection,
    {
      body: {
        page: 1,
        limit: 2,
        search: failString,
      } satisfies ITodoListDeletedTodoLog.IRequest,
    },
  );
  typia.assert(emptyFiltered);
  TestValidator.equals(
    "negative search yields no data",
    emptyFiltered.data.length,
    0,
  );
}
