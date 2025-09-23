import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Verify admin user update for user profiles (PUT
 * /todoList/admin/users/{userId})
 *
 * 1. Register an admin via admin join (random email/password_hash)
 * 2. Login as admin
 * 3. Register a user via user join (random email/password, with optional
 *    name/avatar)
 * 4. As admin, update the user's name, status, and avatar_uri via the users.update
 *    API
 * 5. Confirm updated fields are reflected in the returned user object (excluding
 *    credential hash)
 * 6. Attempt to update with duplicate email (should fail)
 * 7. Attempt to update with obviously invalid status (should fail)
 */
export async function test_api_admin_user_update_profile_success(
  connection: api.IConnection,
) {
  // 1. Register an admin and login
  const adminEmail = typia.random<string & tags.Format<"email">>();
  const adminPwd = RandomGenerator.alphaNumeric(16);
  await api.functional.auth.admin.join(connection, {
    body: {
      email: adminEmail,
      password_hash: adminPwd,
      name: RandomGenerator.name(),
      avatar_uri: null,
      privilege_level: "support",
      status: "active",
    } satisfies ITodoListAdmin.IJoin,
  });
  await api.functional.auth.admin.login(connection, {
    body: {
      email: adminEmail,
      password: adminPwd,
    } satisfies ITodoListAdmin.ILogin,
  });

  // 2. Create a new user
  const originalEmail = typia.random<string & tags.Format<"email">>();
  const userPwd = RandomGenerator.alphaNumeric(12);
  const userJoinResult = await api.functional.auth.user.join(connection, {
    body: {
      email: originalEmail,
      password: userPwd,
      name: RandomGenerator.name(),
      avatar_uri: null,
    } satisfies ITodoListUser.IJoin,
  });
  const userId = userJoinResult.id;
  typia.assert(userJoinResult);

  // 3. Update user's name, status, and avatar as admin
  const updatedName = RandomGenerator.name(2);
  const updatedAvatar =
    "https://cdn.example.com/avatar/" + RandomGenerator.alphaNumeric(12);
  const updatedStatus = "active";
  const updateRes = await api.functional.todoList.admin.users.update(
    connection,
    {
      userId,
      body: {
        name: updatedName,
        avatar_uri: updatedAvatar,
        status: updatedStatus,
      } satisfies ITodoListUser.IUpdate,
    },
  );
  typia.assert(updateRes);
  TestValidator.equals("name updated", updateRes.name, updatedName);
  TestValidator.equals("avatar updated", updateRes.avatar_uri, updatedAvatar);
  TestValidator.equals("status updated", updateRes.status, updatedStatus);

  // 4. Try updating the user's email to a duplicate
  const otherUserJoin = await api.functional.auth.user.join(connection, {
    body: {
      email: typia.random<string & tags.Format<"email">>(),
      password: RandomGenerator.alphaNumeric(12),
      name: RandomGenerator.name(),
    } satisfies ITodoListUser.IJoin,
  });
  await TestValidator.error(
    "should fail updating with duplicate email",
    async () => {
      await api.functional.todoList.admin.users.update(connection, {
        userId,
        body: {
          email: otherUserJoin.user.email,
        } satisfies ITodoListUser.IUpdate,
      });
    },
  );

  // 5. Try updating to an invalid status (empty string)
  await TestValidator.error(
    "should fail updating with invalid status",
    async () => {
      await api.functional.todoList.admin.users.update(connection, {
        userId,
        body: {
          status: "",
        } satisfies ITodoListUser.IUpdate,
      });
    },
  );
}
