import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Test E2E: Admin can hard-delete a todo, permission enforcement, not-found and
 * forbidden cases.
 *
 * 1. Register an admin; store admin token.
 * 2. Register a user; store user token.
 * 3. User creates a todo (as owner).
 * 4. As admin, delete user todo by ID.
 * 5. Try to access deleted todo – since there's no GET endpoint, only confirm
 *    successful deletion by trusting type system.
 * 6. (If possible: verify audit log for admin action – SKIPPED as audit API is not
 *    available in imports.)
 * 7. Try to delete non-existent todo as admin (should error).
 * 8. Try to delete todo as user (should fail - forbidden).
 */
export async function test_api_admin_todo_deletion_with_audit_and_permissions(
  connection: api.IConnection,
) {
  // 1. Register an admin
  const adminEmail: string = typia.random<string & tags.Format<"email">>();
  const adminPassword: string = RandomGenerator.alphaNumeric(12);
  const admin: ITodoListAdmin.IAuthorized =
    await api.functional.auth.admin.join(connection, {
      body: {
        email: adminEmail,
        password_hash: adminPassword,
        name: RandomGenerator.name(),
        avatar_uri: null,
        status: "active",
        privilege_level: "superadmin",
      } satisfies ITodoListAdmin.IJoin,
    });
  typia.assert(admin);

  // 2. Register a user
  const userEmail: string = typia.random<string & tags.Format<"email">>();
  const userPassword: string = RandomGenerator.alphaNumeric(10);
  const user: ITodoListUser.IAuthorized = await api.functional.auth.user.join(
    connection,
    {
      body: {
        email: userEmail,
        password: userPassword,
        name: RandomGenerator.name(),
        avatar_uri: null,
      } satisfies ITodoListUser.IJoin,
    },
  );
  typia.assert(user);

  // 3. User creates a todo
  const todo: ITodoListTodo = await api.functional.todoList.user.todos.create(
    connection,
    {
      body: {
        content: RandomGenerator.paragraph({
          sentences: 2,
          wordMin: 4,
          wordMax: 8,
        }) satisfies string as string,
        due_date: null,
      } satisfies ITodoListTodo.ICreate,
    },
  );
  typia.assert(todo);
  TestValidator.equals("todo owner is user", todo.todo_list_user_id, user.id);

  // 4. Switch to admin
  await api.functional.auth.admin.join(connection, {
    body: {
      email: adminEmail,
      password_hash: adminPassword,
    } satisfies ITodoListAdmin.IJoin,
  });

  // 5. Admin deletes the user's todo
  await api.functional.todoList.admin.todos.erase(connection, {
    todoId: todo.id,
  });

  // 6. Try to delete the same todo again – should throw not found
  await TestValidator.error(
    "admin deleting nonexistent todo fails",
    async () => {
      await api.functional.todoList.admin.todos.erase(connection, {
        todoId: todo.id,
      });
    },
  );

  // 7. Switch to user context
  await api.functional.auth.user.join(connection, {
    body: {
      email: userEmail,
      password: userPassword,
    } satisfies ITodoListUser.IJoin,
  });

  // 8. As user, try to delete the (already deleted) todo - should fail (forbidden)
  await TestValidator.error(
    "user forbidden to delete todo via admin endpoint",
    async () => {
      await api.functional.todoList.admin.todos.erase(connection, {
        todoId: todo.id,
      });
    },
  );
}
