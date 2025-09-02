import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import type { IPageITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListTodo";
import type { IPage } from "@ORGANIZATION/PROJECT-api/lib/structures/IPage";

export async function test_api_todo_list_query_invalid_authentication(
  connection: api.IConnection,
) {
  /**
   * Validate access control for retrieving the user's todo list with missing or
   * invalid authentication.
   *
   * Steps:
   *
   * 1. Register a new user account (as dependency/setup). This is required to
   *    guarantee a valid user exists and to demonstrate that authentication
   *    would normally work if provided.
   * 2. Attempt to access the user's todo list via PATCH /todoList/user/todos
   *    without any Authorization header:
   *
   *    - Compose an api.IConnection with headers unset (empty object ensures no
   *         Authorization present).
   *    - Call api.functional.todoList.user.todos.index and expect a 401 Unauthorized
   *         error.
   * 3. Attempt access using an obviously invalid token:
   *
   *    - Compose api.IConnection with headers.Authorization = 'Bearer INVALIDTOKEN'.
   *    - Call api.functional.todoList.user.todos.index and expect a 401 Unauthorized
   *         error.
   * 4. In both cases, ensure that no todo list data (of type
   *    IPageITodoListTodo.ISummary) is ever returned by a failed request.
   */

  // 1. Register a valid user (to prove authentication works if needed and to set up context for failure cases).
  const email = typia.random<string & tags.Format<"email">>();
  const password = typia.random<
    string & tags.MinLength<8> & tags.MaxLength<128>
  >();
  const joinOutput = await api.functional.auth.user.join(connection, {
    body: { email, password } satisfies ITodoListUser.IJoin,
  });
  typia.assert(joinOutput);

  // 2. Try access with missing auth header (unauthorized connection)
  const unauthConn: api.IConnection = { ...connection, headers: {} };
  await TestValidator.error(
    "should reject unauthenticated todo list access",
    async () => {
      await api.functional.todoList.user.todos.index(unauthConn, {
        body: {} satisfies ITodoListTodo.IRequest,
      });
    },
  );

  // 3. Try access with invalid Authorization header (simulates expired or tampered token)
  const invalidAuthConn: api.IConnection = {
    ...connection,
    headers: { Authorization: "Bearer INVALIDTOKEN" },
  };
  await TestValidator.error(
    "should reject invalid token todo list access",
    async () => {
      await api.functional.todoList.user.todos.index(invalidAuthConn, {
        body: {} satisfies ITodoListTodo.IRequest,
      });
    },
  );
}
