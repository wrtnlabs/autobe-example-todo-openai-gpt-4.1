import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Validate admin retrieval of any user's todo by id including audit fields and
 * access scope.
 *
 * 1. Register and authenticate a new admin (gather credentials for later login)
 * 2. Register a normal user to create a target todo
 * 3. As user, create a todo (capture todoId)
 * 4. Switch auth to admin (login using credentials)
 * 5. Retrieve the user's todo via admin endpoint (with captured id)
 * 6. Validate all fields & audit (ownership, created/updated)
 * 7. Admin can access arbitrary user's todo (cross-role check)
 * 8. Admin attempts to retrieve non-existent todoId (error expected)
 * 9. (Edge) Admin attempts retrieval of inaccessible/deleted todo (error expected)
 */
export async function test_api_admin_todo_retrieval_full_audit_scope(
  connection: api.IConnection,
) {
  // 1. Register admin (capture credentials for login)
  const adminEmail = typia.random<string & tags.Format<"email">>();
  const adminPassword = RandomGenerator.alphaNumeric(12);
  const adminJoinResult = await api.functional.auth.admin.join(connection, {
    body: {
      email: adminEmail,
      password_hash: adminPassword,
      name: RandomGenerator.name(),
      status: "active",
      privilege_level: "auditor",
    } satisfies ITodoListAdmin.IJoin,
  });
  typia.assert(adminJoinResult);
  const adminId = adminJoinResult.id;

  // 2. Register user (to create test todo)
  const userEmail = typia.random<string & tags.Format<"email">>();
  const userPassword = RandomGenerator.alphaNumeric(12);
  const userJoinResult = await api.functional.auth.user.join(connection, {
    body: {
      email: userEmail,
      password: userPassword,
      name: RandomGenerator.name(),
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(userJoinResult);
  const userId = userJoinResult.id;

  // 3. Authenticate as user and create todo
  await api.functional.auth.user.login(connection, {
    body: {
      email: userEmail,
      password: userPassword,
    } satisfies ITodoListUser.ILogin,
  });

  const todoContent = RandomGenerator.paragraph({
    sentences: 3,
    wordMin: 5,
    wordMax: 10,
  });
  const todoDueDate = RandomGenerator.date(new Date(), 1000 * 60 * 60 * 24 * 7)
    .toISOString()
    .substring(0, 10);
  const todoCreate = await api.functional.todoList.user.todos.create(
    connection,
    {
      body: {
        content: todoContent as string,
        due_date: todoDueDate,
      } satisfies ITodoListTodo.ICreate,
    },
  );
  typia.assert(todoCreate);
  const todoId = todoCreate.id;
  const originalTodo = todoCreate;

  // 4. Switch authentication to admin
  await api.functional.auth.admin.login(connection, {
    body: {
      email: adminEmail,
      password: adminPassword,
    } satisfies ITodoListAdmin.ILogin,
  });

  // 5. Retrieve as admin
  const adminViewTodo = await api.functional.todoList.admin.todos.at(
    connection,
    { todoId },
  );
  typia.assert(adminViewTodo);
  // 6. Validate all returned fields
  TestValidator.equals(
    "admin sees todo id matches",
    adminViewTodo.id,
    originalTodo.id,
  );
  TestValidator.equals(
    "admin sees correct owner id",
    adminViewTodo.todo_list_user_id,
    userId,
  );
  TestValidator.equals(
    "admin sees content",
    adminViewTodo.content,
    todoContent,
  );
  TestValidator.equals(
    "admin sees due date",
    adminViewTodo.due_date,
    todoDueDate,
  );
  TestValidator.equals("admin sees completion", adminViewTodo.completed, false);
  TestValidator.equals(
    "admin sees creation date",
    adminViewTodo.created_at,
    originalTodo.created_at,
  );
  TestValidator.equals(
    "admin sees update date",
    adminViewTodo.updated_at,
    originalTodo.updated_at,
  );
  TestValidator.equals(
    "admin sees completed_at is null",
    adminViewTodo.completed_at,
    null,
  );

  // 7. Admin can access user's todo (cross-role check)
  // (already validated above by using userId)

  // 8. Attempt to retrieve non-existent todoId (expect not-found error)
  const nonExistentTodoId = typia.random<string & tags.Format<"uuid">>();
  await TestValidator.error(
    "admin retrieval of non-existent todo triggers error",
    async () => {
      await api.functional.todoList.admin.todos.at(connection, {
        todoId: nonExistentTodoId,
      });
    },
  );

  // 9. (Edge) Attempt retrieve of inaccessible/deleted todo (simulate delete by random uuid)
  // No explicit soft delete API, simulate with another uuid
  await TestValidator.error(
    "admin retrieval of soft/nonexistent todo triggers error",
    async () => {
      await api.functional.todoList.admin.todos.at(connection, {
        todoId: typia.random<string & tags.Format<"uuid">>(),
      });
    },
  );
}
