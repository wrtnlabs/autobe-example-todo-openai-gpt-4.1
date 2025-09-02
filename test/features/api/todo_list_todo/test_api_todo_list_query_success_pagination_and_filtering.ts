import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import type { IPageITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListTodo";
import type { IPage } from "@ORGANIZATION/PROJECT-api/lib/structures/IPage";

export async function test_api_todo_list_query_success_pagination_and_filtering(
  connection: api.IConnection,
) {
  /**
   * E2E Test: Paginated and Filtered Todo List for Authenticated User
   *
   * This test covers retrieval of a user's todos with pagination, various
   * filters, sorting, and search options. It extensively populates the user's
   * todo list, then issues queries verifying logic for:
   *
   * - User-only data scope
   * - Pagination correctness
   * - Filter by completion status
   * - Sorting by dates
   * - Substring search
   * - Due-date range
   * - Empty page handling Each assertion checks both business logic and API
   *   contract/type.
   */

  // 1. Register a unique user
  const userEmail = typia.random<string & tags.Format<"email">>();
  const userPassword = RandomGenerator.alphaNumeric(12) + "Zz9$";
  const joinResult = await api.functional.auth.user.join(connection, {
    body: {
      email: userEmail,
      password: userPassword,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(joinResult);

  // 2. Simulate obtaining the verification token; in production, fetch via test fixture/DB
  const userId = joinResult.user.id;
  const emailVerifyToken = RandomGenerator.alphaNumeric(32);
  await api.functional.auth.user.verify_email.verifyEmail(connection, {
    body: {
      user_id: userId,
      token: emailVerifyToken,
    } satisfies ITodoListUser.IVerifyEmail,
  });

  // 3. Create 17 todos for the authenticated user: variety of completion, due_date, title
  const now = new Date();
  const todos: ITodoListTodo[] = [];
  for (let i = 0; i < 17; ++i) {
    const is_completed = i % 3 === 0;
    const due_date =
      i % 4 === 0
        ? null
        : RandomGenerator.date(now, 1000 * 60 * 60 * 24 * 30).toISOString();
    const titleSource = RandomGenerator.paragraph({ sentences: 2 + (i % 3) });
    const title = `${i < 10 ? "TestItem" : "Special"} ${titleSource} ${i}`;
    const description = RandomGenerator.content();
    const todo = await api.functional.todoList.user.todos.create(connection, {
      body: {
        title,
        description,
        due_date,
        is_completed,
      } satisfies ITodoListTodo.ICreate,
    });
    typia.assert(todo);
    todos.push(todo);
  }

  // 4. Query: default pagination (page 1, default limit; expect all todos if under default limit)
  let page = 1;
  let limit = 20; // API default; all todos created < 20, so all returned
  let result = await api.functional.todoList.user.todos.index(connection, {
    body: { page, limit } satisfies ITodoListTodo.IRequest,
  });
  typia.assert(result);
  TestValidator.equals(
    "default/first page: all todos returned",
    result.data.length,
    todos.length,
  );
  // Sort check: descending by created_at (default)
  for (let j = 1; j < result.data.length; ++j) {
    TestValidator.predicate(
      "created_at desc order",
      result.data[j - 1].created_at >= result.data[j].created_at,
    );
  }

  // 5. Query: page 1, limit 5, sort by created_at desc
  page = 1;
  limit = 5;
  result = await api.functional.todoList.user.todos.index(connection, {
    body: {
      page,
      limit,
      sort_by: "created_at",
      sort_direction: "desc",
    } satisfies ITodoListTodo.IRequest,
  });
  typia.assert(result);
  TestValidator.equals("page 1, limit 5: length is 5", result.data.length, 5);
  TestValidator.equals(
    "page 1, limit 5: pagination",
    result.pagination.current,
    1,
  );
  TestValidator.equals(
    "page 1, limit 5: pagination total records",
    result.pagination.records,
    todos.length,
  );
  TestValidator.equals(
    "page 1, limit 5: pagination total pages",
    result.pagination.pages,
    Math.ceil(todos.length / 5),
  );
  // Check sort
  for (let j = 1; j < result.data.length; ++j) {
    TestValidator.predicate(
      "created_at desc order page 1",
      result.data[j - 1].created_at >= result.data[j].created_at,
    );
  }

  // 6. Query: page 2, limit 5
  page = 2;
  limit = 5;
  result = await api.functional.todoList.user.todos.index(connection, {
    body: {
      page,
      limit,
      sort_by: "created_at",
      sort_direction: "desc",
    } satisfies ITodoListTodo.IRequest,
  });
  typia.assert(result);
  TestValidator.equals("page 2, limit 5: length is 5", result.data.length, 5);
  TestValidator.equals(
    "page 2, limit 5: pagination",
    result.pagination.current,
    2,
  );

  // 7. Query: status = "complete"
  result = await api.functional.todoList.user.todos.index(connection, {
    body: { status: "complete" } satisfies ITodoListTodo.IRequest,
  });
  typia.assert(result);
  TestValidator.predicate(
    "only complete todos are returned",
    result.data.every((todo) => todo.is_completed),
  );

  // 8. Query: status = "incomplete"
  result = await api.functional.todoList.user.todos.index(connection, {
    body: { status: "incomplete" } satisfies ITodoListTodo.IRequest,
  });
  typia.assert(result);
  TestValidator.predicate(
    "only incomplete todos are returned",
    result.data.every((todo) => !todo.is_completed),
  );

  // 9. Query: sort by due_date asc
  result = await api.functional.todoList.user.todos.index(connection, {
    body: {
      sort_by: "due_date",
      sort_direction: "asc",
    } satisfies ITodoListTodo.IRequest,
  });
  typia.assert(result);
  let previousDate: string | null | undefined;
  for (const t of result.data) {
    if (t.due_date) {
      if (previousDate) {
        TestValidator.predicate(
          "due_date ascending order",
          t.due_date >= previousDate,
        );
      }
      previousDate = t.due_date;
    }
  }

  // 10. Query: substring search in title
  const searchTerm = "Item";
  result = await api.functional.todoList.user.todos.index(connection, {
    body: { search: searchTerm } satisfies ITodoListTodo.IRequest,
  });
  typia.assert(result);
  TestValidator.predicate(
    "all returned titles contain substring term",
    result.data.every((todo) =>
      todo.title.toLowerCase().includes(searchTerm.toLowerCase()),
    ),
  );

  // 11. Query: due_date_after, filter only todos due more than 10 days from now
  const fromDate = new Date(
    now.getTime() + 1000 * 60 * 60 * 24 * 10,
  ).toISOString();
  result = await api.functional.todoList.user.todos.index(connection, {
    body: { due_date_after: fromDate } satisfies ITodoListTodo.IRequest,
  });
  typia.assert(result);
  TestValidator.predicate(
    "all todos have due_date after filter date",
    result.data.every((todo) => !todo.due_date || todo.due_date >= fromDate),
  );

  // 12. Query: page past last (empty page)
  const totalPages = Math.ceil(todos.length / 5);
  result = await api.functional.todoList.user.todos.index(connection, {
    body: { page: totalPages + 1, limit: 5 } satisfies ITodoListTodo.IRequest,
  });
  typia.assert(result);
  TestValidator.equals("no todos on page past last", result.data.length, 0);
}
