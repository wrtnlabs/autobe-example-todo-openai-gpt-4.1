import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";

/**
 * Test updating an admin's profile (email) after registering and creating a
 * Todo item.
 *
 * Steps:
 *
 * 1. Register a new admin and obtain id/token (join).
 * 2. As this admin, create a Todo (to ensure valid adminId via activity).
 * 3. Update admin profile's email via PUT (adminId, new email).
 * 4. Validate id is unchanged, email is updated, created_at is unchanged,
 *    updated_at is updated.
 */
export async function test_api_admin_profile_update_success(
  connection: api.IConnection,
) {
  // 1. Register a new admin
  const email1 = typia.random<string & tags.Format<"email">>();
  const password = RandomGenerator.alphaNumeric(12);
  const authorized = await api.functional.auth.admin.join(connection, {
    body: { email: email1, password } satisfies ITodoListAdmin.ICreate,
  });
  typia.assert(authorized);

  // 2. Create a Todo as this admin (to make adminId usable)
  const todo = await api.functional.todoList.admin.todos.create(connection, {
    body: {
      title: RandomGenerator.paragraph({ sentences: 3 }),
    } satisfies ITodoListTodo.ICreate,
  });
  typia.assert(todo);
  TestValidator.equals(
    "admin id matches on todo",
    todo.todo_list_user_id,
    authorized.id,
  );

  // 3. Update profile (change email)
  const email2 = typia.random<string & tags.Format<"email">>();
  const result = await api.functional.todoList.admin.admins.update(connection, {
    adminId: authorized.id,
    body: { email: email2 } satisfies ITodoListAdmin.IUpdate,
  });
  typia.assert(result);

  // 4. Validate expected changes
  TestValidator.equals("admin id unchanged", result.id, authorized.id);
  TestValidator.equals("email updated", result.email, email2);
  TestValidator.equals(
    "created at unchanged",
    result.created_at,
    authorized.created_at,
  );
  TestValidator.notEquals(
    "updated_at refreshed",
    result.updated_at,
    authorized.updated_at,
  );
}
