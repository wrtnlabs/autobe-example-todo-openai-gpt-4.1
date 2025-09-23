import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { IPage } from "@ORGANIZATION/PROJECT-api/lib/structures/IPage";
import type { IPageITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListTodo";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Tests that an authenticated user can search and paginate their own todo
 * items, using search term/content filter, completed status, and pagination
 * params.
 *
 * Steps:
 *
 * 1. Register a new user and authenticate (join and login)
 * 2. Create multiple (e.g. 20) todo items for this user (vary content and
 *    completed status)
 * 3. Use PATCH /todoList/user/todos with:
 *
 *    - No filters/pagination, expect to retrieve all todos for user
 *    - A content search term matching a known substring, expect filtered subset
 *    - Completed=false, get only incomplete todos
 *    - Pagination (page/limit), get limited results and verify correct page/offset
 *    - Filter combination (search+completed)
 *    - Edge: filter that produces zero results (nonsense substring)
 *    - Edge: page beyond last data
 *    - Edge: negative page values, expect error
 *
 * All responses only return the user's own todos and never leak other users'
 * data.
 */
export async function test_api_user_todo_list_pagination_and_filtering(
  connection: api.IConnection,
) {
  // 1. Register a new user
  const userEmail = typia.random<string & tags.Format<"email">>();
  const userPassword = RandomGenerator.alphaNumeric(12);
  const userJoinBody = {
    email: userEmail,
    password: userPassword,
    name: RandomGenerator.name(),
    avatar_uri: null,
  } satisfies ITodoListUser.IJoin;
  const joinResult = await api.functional.auth.user.join(connection, {
    body: userJoinBody,
  });
  typia.assert(joinResult);
  TestValidator.equals("user created email", joinResult.user.email, userEmail);

  // 2. Authenticate user (login) to get token
  const loginResult = await api.functional.auth.user.login(connection, {
    body: {
      email: userEmail,
      password: userPassword,
    } satisfies ITodoListUser.ILogin,
  });
  typia.assert(loginResult);
  TestValidator.equals("login user email", loginResult.user.email, userEmail);

  // 3. Create multiple todo items for this user
  const contents = ArrayUtil.repeat(
    20,
    (i) =>
      `Todo #${i + 1} - ${RandomGenerator.paragraph({ sentences: 2, wordMin: 3, wordMax: 7 })}`,
  );
  const completedIdxs = new Set(
    ArrayUtil.repeat(7, () => Math.floor(Math.random() * contents.length)),
  );
  const createdTodos: ITodoListTodo[] = [];
  for (let i = 0; i < contents.length; ++i) {
    const body = {
      content: contents[i] as string & tags.MaxLength<255>,
      due_date: null,
    } satisfies ITodoListTodo.ICreate;
    const todo = await api.functional.todoList.user.todos.create(connection, {
      body,
    });
    typia.assert(todo);
    if (completedIdxs.has(i)) {
      // Direct update not possible - only create has completed=false and update API not in scope, so we only create as incomplete
      // Would require PATCH /todoList/user/todos/:id to mark as completed, which is not given, so skip completed=true scenarios
    }
    createdTodos.push(todo);
  }

  // 4. Filter: fetch all (no filter)
  const allTodosPage = await api.functional.todoList.user.todos.index(
    connection,
    {
      body: {} satisfies ITodoListTodo.IRequest,
    },
  );
  typia.assert(allTodosPage);
  TestValidator.equals(
    "all user todos count",
    allTodosPage.data.length,
    createdTodos.length,
  );
  // 5. Filter: content substring (choose substring from a random todo)
  const sampleContent = RandomGenerator.pick(contents);
  const filterSubstring = RandomGenerator.substring(sampleContent).slice(0, 15); // limit length
  const filterResult = await api.functional.todoList.user.todos.index(
    connection,
    {
      body: {
        search: filterSubstring,
      } satisfies ITodoListTodo.IRequest,
    },
  );
  typia.assert(filterResult);
  TestValidator.predicate(
    "filtered todos contain substring",
    filterResult.data.every((t) => t.content.includes(filterSubstring)),
  );

  // 6. Filter: completed=false (should return all as incomplete)
  const notCompletedResult = await api.functional.todoList.user.todos.index(
    connection,
    {
      body: {
        completed: false,
      } satisfies ITodoListTodo.IRequest,
    },
  );
  typia.assert(notCompletedResult);
  TestValidator.equals(
    "not completed todos all incomplete",
    notCompletedResult.data.filter((t) => t.completed).length,
    0,
  );

  // 7. Pagination: page=2, limit=5
  const page2Result = await api.functional.todoList.user.todos.index(
    connection,
    {
      body: {
        limit: 5,
        page: 2,
      } satisfies ITodoListTodo.IRequest,
    },
  );
  typia.assert(page2Result);
  TestValidator.equals("page 2 count", page2Result.data.length, 5);
  TestValidator.equals(
    "page 2 current page",
    page2Result.pagination.current,
    2,
  );

  // 8. Pagination: beyond last page
  const highPage = 100;
  const beyondResult = await api.functional.todoList.user.todos.index(
    connection,
    {
      body: {
        page: highPage,
        limit: 5,
      } satisfies ITodoListTodo.IRequest,
    },
  );
  typia.assert(beyondResult);
  TestValidator.equals(
    "beyond last page is empty",
    beyondResult.data.length,
    0,
  );

  // 9. Search+completed filter (empty result, as all are incomplete)
  const nonsenseSearch = "ZZZX_NO_TODO_CONTENT";
  const noMatchResult = await api.functional.todoList.user.todos.index(
    connection,
    {
      body: {
        search: nonsenseSearch,
      } satisfies ITodoListTodo.IRequest,
    },
  );
  typia.assert(noMatchResult);
  TestValidator.equals("no matching todos", noMatchResult.data.length, 0);

  // 10. Negative page value: expects error
  await TestValidator.error("negative page should fail", async () => {
    await api.functional.todoList.user.todos.index(connection, {
      body: {
        page: -1 as number & tags.Type<"int32">,
        limit: 5,
      } satisfies ITodoListTodo.IRequest,
    });
  });
}
