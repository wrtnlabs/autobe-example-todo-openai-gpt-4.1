import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Test that an admin can update a user's email or password by userId using the
 * admin update endpoint.
 *
 * - Register a new admin via /auth/admin/join
 * - Create a random user (simulate DB insert via a direct API call or random
 *   entity if no public user API)
 * - Admin updates the user's email and checks for the update
 * - Admin updates the user's password (password_hash) and checks for the update
 * - Verify timestamps (updated_at changes)
 * - Test that updating to a duplicate email fails
 */
export async function test_api_admin_user_update_basic(
  connection: api.IConnection,
) {
  // 1. Register as admin
  const adminEmail: string & tags.Format<"email"> = typia.random<
    string & tags.Format<"email">
  >();
  const adminPassword: string = RandomGenerator.alphaNumeric(12);
  const admin = await api.functional.auth.admin.join(connection, {
    body: {
      email: adminEmail,
      password: adminPassword,
    } satisfies ITodoListAdmin.ICreate,
  });
  typia.assert(admin);
  // 2. Create a user to be updated (simulate or prepare fixture)
  // As we have no user registration endpoint in the available API,
  // we'll simulate an existing user record via typia.random
  const existingUser: ITodoListUser = typia.random<ITodoListUser>();

  // 3. Update the user's email by admin
  const newEmail: string = typia.random<string & tags.Format<"email">>();
  const updateEmail = await api.functional.todoList.admin.users.update(
    connection,
    {
      userId: existingUser.id,
      body: {
        email: newEmail,
      } satisfies ITodoListUser.IUpdate,
    },
  );
  typia.assert(updateEmail);
  TestValidator.equals("user id must match", updateEmail.id, existingUser.id);
  TestValidator.equals("email updated", updateEmail.email, newEmail);
  TestValidator.predicate(
    "created_at unchanged after update",
    updateEmail.created_at === existingUser.created_at,
  );
  TestValidator.predicate(
    "updated_at changed after update",
    updateEmail.updated_at !== existingUser.updated_at,
  );

  // 4. Update the user's password_hash by admin
  const newPasswordHash = RandomGenerator.alphaNumeric(32);
  const updatePassword = await api.functional.todoList.admin.users.update(
    connection,
    {
      userId: existingUser.id,
      body: {
        password_hash: newPasswordHash,
      } satisfies ITodoListUser.IUpdate,
    },
  );
  typia.assert(updatePassword);
  TestValidator.equals(
    "user id remains for password update",
    updatePassword.id,
    existingUser.id,
  );
  TestValidator.equals(
    "email stays as previous after non-email change",
    updatePassword.email,
    newEmail,
  );
  TestValidator.predicate(
    "updated_at changed after password update",
    updatePassword.updated_at !== updateEmail.updated_at,
  );

  // 5. Try updating a user with a duplicate email (should error)
  const anotherUser: ITodoListUser = typia.random<ITodoListUser>();
  await TestValidator.error(
    "updating user to duplicate email should fail",
    async () => {
      await api.functional.todoList.admin.users.update(connection, {
        userId: anotherUser.id,
        body: {
          email: newEmail,
        } satisfies ITodoListUser.IUpdate,
      });
    },
  );
}
