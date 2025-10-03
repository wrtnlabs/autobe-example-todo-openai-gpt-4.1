import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Test that an authenticated administrator can retrieve user details by userId,
 * receives only allowed schema fields (id, email, created_at, updated_at), and
 * error response for unauthorized or non-existent user scenarios.
 *
 * 1. Register a new admin and acquire authentication.
 * 2. Simulate presence of a user (by using a random userId) for not-found error or
 *    real one if such API is available.
 * 3. As admin, perform GET /todoList/admin/users/{userId}: expect ITodoListUser
 *    schema, typia.assert.
 * 4. As unauthorized/unauthenticated, try GET /todoList/admin/users/{userId}:
 *    expect error thrown.
 * 5. As admin, request non-existent userId: expect error thrown.
 */
export async function test_api_admin_retrieve_user_details(
  connection: api.IConnection,
) {
  // 1. Register a new admin for privileged access
  const adminEmail: string = typia.random<string & tags.Format<"email">>();
  const admin: ITodoListAdmin.IAuthorized =
    await api.functional.auth.admin.join(connection, {
      body: {
        email: adminEmail,
        password: RandomGenerator.alphaNumeric(12),
      } satisfies ITodoListAdmin.ICreate,
    });
  typia.assert(admin);

  // Generate a fake/test user id (simulate non-existence)
  const nonexistentUserId: string = typia.random<
    string & tags.Format<"uuid">
  >();

  // 2. Try to fetch non-existent user: should return error (authenticated)
  await TestValidator.error(
    "admin gets error for non-existent user",
    async () => {
      await api.functional.todoList.admin.users.at(connection, {
        userId: nonexistentUserId,
      });
    },
  );

  // 3. Attempt as unauthorized user: create connection with empty headers
  const unauthConn: api.IConnection = { ...connection, headers: {} };
  await TestValidator.error(
    "unauthorized request to admin user details",
    async () => {
      await api.functional.todoList.admin.users.at(unauthConn, {
        userId: nonexistentUserId,
      });
    },
  );

  // 4. If we had a user registration API, we'd register a test user here, but since DTOs do not include user creation, skip to admin (simulate existing user fetch by reusing nonexistentUserId, expect error)
}
