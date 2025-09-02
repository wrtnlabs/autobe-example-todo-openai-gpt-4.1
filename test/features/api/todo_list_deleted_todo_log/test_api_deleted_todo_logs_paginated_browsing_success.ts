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

export async function test_api_deleted_todo_logs_paginated_browsing_success(
  connection: api.IConnection,
) {
  /**
   * This test validates paginated and filtered browsing of the authenticated
   * user's deleted todo logs.
   *
   * Workflow:
   *
   * 1. Register a new user to obtain an authenticated session.
   * 2. Create a set of todos (5-8) with random data under the user.
   * 3. Delete a subset of those todos (3-4) to generate deleted log entries.
   * 4. Call the deletedTodoLogs index API (PATCH /todoList/user/deletedTodoLogs)
   *    repeatedly using different combinations of pagination, filter, search,
   *    and sort parameters to test every functionality:
   *
   *    - Pagination with various page and limit options
   *    - Search by partial title (substring of a deleted todo)
   *    - Filtering on is_completed (true, false)
   *    - Deleted date range (deleted_since, deleted_before)
   *    - Sort by deleted_at and created_at in both ascending and descending order
   * 5. Validate each response for:
   *
   *    - All entries belong to this authenticated user and correspond to deleted
   *         todos
   *    - Pagination and record count is correct
   *    - Filtering and search criteria match response records
   *    - Sorting order matches request
   */

  // 1. Register a user
  const userEmail = typia.random<string & tags.Format<"email">>();
  const userPassword = RandomGenerator.alphaNumeric(12);
  const joinAuth = await api.functional.auth.user.join(connection, {
    body: {
      email: userEmail,
      password: userPassword,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(joinAuth);

  // 2. Create 7 todos with random data, keeping track for later deletion
  const todoCount = 7;
  const createdTodos: ITodoListTodo[] = [];
  for (let i = 0; i < todoCount; ++i) {
    const todo = await api.functional.todoList.user.todos.create(connection, {
      body: {
        title: RandomGenerator.paragraph({ sentences: 2 }),
        description: i % 2 === 0 ? RandomGenerator.paragraph() : undefined,
        due_date:
          i % 3 === 0
            ? new Date(Date.now() + i * 86400000).toISOString()
            : null,
        is_completed: i % 2 === 0,
      } satisfies ITodoListTodo.ICreate,
    });
    typia.assert(todo);
    createdTodos.push(todo);
  }

  // 3. Delete 4 random todos, store their details for audit log validation
  const toDeleteCount = 4;
  const deletedTodos = RandomGenerator.sample(createdTodos, toDeleteCount);
  for (const todo of deletedTodos) {
    await api.functional.todoList.user.todos.erase(connection, {
      todoId: todo.id,
    });
  }

  // 4. Fetch deleted logs and run paged, filtered, search/sort tests
  // A. Base: fetch page 1/limit 2, should return 2 records, correct pagination
  let res = await api.functional.todoList.user.deletedTodoLogs.index(
    connection,
    {
      body: {
        page: 1,
        limit: 2,
      } satisfies ITodoListDeletedTodoLog.IRequest,
    },
  );
  typia.assert(res);
  TestValidator.equals("pagination limit=2", res.pagination.limit, 2);
  TestValidator.equals("pagination page=1", res.pagination.current, 1);
  TestValidator.equals(
    "records per page",
    res.data.length,
    Math.min(2, toDeleteCount),
  );
  TestValidator.predicate(
    "all logs belong to deleted todos",
    res.data.every((x) =>
      deletedTodos.find((t) => t.id === x.original_todo_id),
    ),
  );
  // B. Fetch page 2, second page
  res = await api.functional.todoList.user.deletedTodoLogs.index(connection, {
    body: {
      page: 2,
      limit: 2,
    } satisfies ITodoListDeletedTodoLog.IRequest,
  });
  typia.assert(res);
  TestValidator.equals("pagination page=2", res.pagination.current, 2);
  TestValidator.predicate(
    "no logs from other users",
    res.data.every((x) =>
      deletedTodos.find((t) => t.id === x.original_todo_id),
    ),
  );
  // C. Filter by is_completed true
  res = await api.functional.todoList.user.deletedTodoLogs.index(connection, {
    body: {
      is_completed: true,
    } satisfies ITodoListDeletedTodoLog.IRequest,
  });
  typia.assert(res);
  TestValidator.predicate(
    "filtered logs only completed",
    res.data.every((x) => x.is_completed === true),
  );
  // D. Search by partial title of one deleted todo
  const searchTerm = RandomGenerator.substring(deletedTodos[0].title);
  res = await api.functional.todoList.user.deletedTodoLogs.index(connection, {
    body: {
      search: searchTerm,
    } satisfies ITodoListDeletedTodoLog.IRequest,
  });
  typia.assert(res);
  TestValidator.predicate(
    "search matches title",
    res.data.every((x) =>
      x.title.toLowerCase().includes(searchTerm.toLowerCase()),
    ),
  );
  // E. Filter by deleted_since and deleted_before (use deleted_at of 1st log as boundary)
  if (res.data.length > 0) {
    const deletedAt = res.data[0].deleted_at;
    const rangeRes = await api.functional.todoList.user.deletedTodoLogs.index(
      connection,
      {
        body: {
          deleted_since: deletedAt,
          deleted_before: deletedAt,
        } satisfies ITodoListDeletedTodoLog.IRequest,
      },
    );
    typia.assert(rangeRes);
    TestValidator.predicate(
      "deleted_at in range",
      rangeRes.data.every((x) => x.deleted_at === deletedAt),
    );
  }
  // F. Sort by created_at asc
  res = await api.functional.todoList.user.deletedTodoLogs.index(connection, {
    body: {
      sort_by: "created_at",
      sort_direction: "asc",
    } satisfies ITodoListDeletedTodoLog.IRequest,
  });
  typia.assert(res);
  for (let i = 1; i < res.data.length; ++i) {
    TestValidator.predicate(
      `created_at sorted asc #${i}`,
      res.data[i - 1].created_at <= res.data[i].created_at,
    );
  }
}
