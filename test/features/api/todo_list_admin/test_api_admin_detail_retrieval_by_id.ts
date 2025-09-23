import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";

/**
 * Validate administrator detail retrieval by ID for privilege management and
 * audit clarity.
 *
 * This test verifies that privileged admins can retrieve the full profile
 * details (excluding sensitive credentials) of another admin using their
 * adminId.
 *
 * 1. Register a first admin, keeping the returned id for detail lookup.
 * 2. Register and login as a second admin session.
 * 3. Using the session of the second admin, request GET
 *    /todoList/admin/admins/{adminId} for the first admin.
 * 4. Validate all profile fields match the first admin; password_hash is never
 *    present.
 * 5. Negative test: request with a random non-existent adminId and check that
 *    error is thrown (no business-logic or status check, only error-throw
 *    assertion).
 */
export async function test_api_admin_detail_retrieval_by_id(
  connection: api.IConnection,
) {
  // 1. Register first admin account to be the detail target
  const admin1_email = typia.random<string & tags.Format<"email">>();
  const admin1_password = RandomGenerator.alphaNumeric(10);
  const admin1_name = RandomGenerator.name();
  const admin1_avatar = undefined;
  const admin1_status = "active";
  const admin1_privilege = "support";
  const admin1_join = await api.functional.auth.admin.join(connection, {
    body: {
      email: admin1_email,
      password_hash: admin1_password,
      name: admin1_name,
      avatar_uri: admin1_avatar,
      status: admin1_status,
      privilege_level: admin1_privilege,
    } satisfies ITodoListAdmin.IJoin,
  });
  typia.assert(admin1_join);
  const admin1_id = admin1_join.id;
  const admin1_profile = admin1_join.admin;

  // 2. Register and login as second admin to represent an actor session
  const admin2_email = typia.random<string & tags.Format<"email">>();
  const admin2_password = RandomGenerator.alphaNumeric(10);
  const admin2_join = await api.functional.auth.admin.join(connection, {
    body: {
      email: admin2_email,
      password_hash: admin2_password,
      name: RandomGenerator.name(),
      status: "active",
      privilege_level: "superadmin",
    } satisfies ITodoListAdmin.IJoin,
  });
  typia.assert(admin2_join);
  await api.functional.auth.admin.login(connection, {
    body: {
      email: admin2_email,
      password: admin2_password,
    } satisfies ITodoListAdmin.ILogin,
  });

  // 3. As second admin, perform detail GET lookup on first admin
  const output = await api.functional.todoList.admin.admins.at(connection, {
    adminId: admin1_id,
  });
  typia.assert(output);

  // 4. Assert all returned fields match first admin registration (except timestamps, last_login/last_action may update)
  TestValidator.equals(
    "admin profile id matches target",
    output.id,
    admin1_profile.id,
  );
  TestValidator.equals(
    "admin email matches target",
    output.email,
    admin1_profile.email,
  );
  TestValidator.equals(
    "admin name matches target",
    output.name,
    admin1_profile.name,
  );
  TestValidator.equals(
    "admin avatar_uri matches target",
    output.avatar_uri,
    admin1_profile.avatar_uri,
  );
  TestValidator.equals(
    "admin status matches target",
    output.status,
    admin1_profile.status,
  );
  TestValidator.equals(
    "admin privilege_level matches target",
    output.privilege_level,
    admin1_profile.privilege_level,
  );
  TestValidator.equals(
    "admin deleted_at matches target",
    output.deleted_at,
    admin1_profile.deleted_at,
  );

  // Optional timestamp fields (nullable/null/undef - check contract compliance)
  TestValidator.predicate(
    "admin created_at is a non-empty string",
    typeof output.created_at === "string" && output.created_at.length > 0,
  );
  TestValidator.predicate(
    "admin updated_at is a non-empty string",
    typeof output.updated_at === "string" && output.updated_at.length > 0,
  );
  TestValidator.predicate(
    "admin last_admin_action_at is string or null or undefined",
    output.last_admin_action_at === null ||
      output.last_admin_action_at === undefined ||
      typeof output.last_admin_action_at === "string",
  );
  TestValidator.predicate(
    "admin last_login_at is string or null or undefined",
    output.last_login_at === null ||
      output.last_login_at === undefined ||
      typeof output.last_login_at === "string",
  );

  // 4b. Assert NO password_hash field
  TestValidator.predicate(
    "output never exposes password_hash property",
    !Object.prototype.hasOwnProperty.call(output, "password_hash"),
  );

  // 5. Generate a random adminId that cannot collide with existing
  let random_admin_id: string & tags.Format<"uuid">;
  do {
    random_admin_id = typia.random<string & tags.Format<"uuid">>();
  } while (random_admin_id === admin1_id || random_admin_id === admin2_join.id);

  await TestValidator.error(
    "should throw error for non-existent adminId",
    async () => {
      await api.functional.todoList.admin.admins.at(connection, {
        adminId: random_admin_id,
      });
    },
  );
}
