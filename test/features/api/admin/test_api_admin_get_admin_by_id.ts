import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";

/**
 * Validate that an admin can retrieve their detailed profile by adminId.
 *
 * Steps:
 *
 * 1. Register a new admin user (store resulting id, email, etc.).
 * 2. Ensure authentication as this admin (token is handled by join).
 * 3. Create a Todo as the admin to confirm setup.
 * 4. Retrieve the admin profile using the /todoList/admin/admins/{adminId}
 *    endpoint with own id.
 * 5. Validate all required ITodoListAdmin fields are present with expected
 *    types/formats.
 * 6. Match the returned admin data against registration values for consistency.
 */
export async function test_api_admin_get_admin_by_id(
  connection: api.IConnection,
) {
  // 1. Register a new admin, returns IAuthorized (id, email, timestamps, token)
  const adminEmail: string = typia.random<string & tags.Format<"email">>();
  const password: string & tags.MinLength<8> = RandomGenerator.alphaNumeric(12);
  const joinResult = await api.functional.auth.admin.join(connection, {
    body: {
      email: adminEmail,
      password: password,
    } satisfies ITodoListAdmin.ICreate,
  });
  typia.assert(joinResult);

  // 2. (join already set the admin's access token in connection)

  // 3. Create a Todo as this admin (to simulate activity; not strictly required)
  const todo = await api.functional.todoList.admin.todos.create(connection, {
    body: {
      title: RandomGenerator.paragraph({
        sentences: 2,
        wordMin: 3,
        wordMax: 9,
      }),
    } satisfies ITodoListTodo.ICreate,
  });
  typia.assert(todo);

  // 4. Retrieve admin profile with their id
  const result = await api.functional.todoList.admin.admins.at(connection, {
    adminId: joinResult.id,
  });
  typia.assert(result);

  // 5. Validate all fields and format constraints
  TestValidator.equals("admin id matches", result.id, joinResult.id);
  TestValidator.equals("admin email matches", result.email, joinResult.email);
  TestValidator.equals(
    "created_at matches",
    result.created_at,
    joinResult.created_at,
  );
  TestValidator.equals(
    "updated_at matches",
    result.updated_at,
    joinResult.updated_at,
  );
  // Check format using typia.assert ensures all constraints, nothing more needed
}
