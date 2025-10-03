import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { IPage } from "@ORGANIZATION/PROJECT-api/lib/structures/IPage";
import type { IPageITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListTodo";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";

/**
 * Minimal E2E test: Admin registration, create todo, retrieve todo list as
 * admin
 *
 * 1. Register an admin using /auth/admin/join and store credentials
 * 2. Create a Todo as the authenticated admin using /todoList/admin/todos (POST)
 * 3. Retrieve the paginated list of Todos with /todoList/admin/todos (PATCH) as
 *    admin
 * 4. Assert the created Todo appears in the paginated result set
 */
export async function test_api_admin_todo_list_retrieval(
  connection: api.IConnection,
) {
  // 1. Admin registration
  const adminEmail = typia.random<string & tags.Format<"email">>();
  const adminPassword = RandomGenerator.alphaNumeric(12);
  const admin = await api.functional.auth.admin.join(connection, {
    body: {
      email: adminEmail,
      password: adminPassword,
    } satisfies ITodoListAdmin.ICreate,
  });
  typia.assert(admin);

  // 2. Create a Todo as admin
  const title = RandomGenerator.paragraph({
    sentences: 1,
    wordMin: 3,
    wordMax: 10,
  });
  const todo = await api.functional.todoList.admin.todos.create(connection, {
    body: {
      title,
    } satisfies ITodoListTodo.ICreate,
  });
  typia.assert(todo);

  // 3. Retrieve the paginated Todo list as admin
  const page = await api.functional.todoList.admin.todos.index(connection, {
    body: {}, // minimal request; all parameters optional
  });
  typia.assert(page);

  // 4. Assert created Todo is present in paginated admin view
  const found = page.data.find((t) => t.id === todo.id);
  TestValidator.predicate(
    "created Todo appears in admin-retrieved list",
    found !== undefined,
  );
  if (found) {
    TestValidator.equals("Todo title matches", found.title, title);
  }
}
