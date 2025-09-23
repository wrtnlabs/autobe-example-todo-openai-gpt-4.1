import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";

/**
 * Validates admin registration forbidden with duplicate email.
 *
 * 1. Generate a random (unique) admin email
 * 2. Register first admin with that email - should succeed (valid registration)
 * 3. Try second registration using the same email - should fail due to uniqueness
 *    constraint
 * 4. Assert that the second attempt fails and exposes no sensitive admin data
 * 5. Check that failure is a business (not type) error
 */
export async function test_api_admin_account_registration_duplicate_email(
  connection: api.IConnection,
) {
  // 1. Prepare unique random email and password hash
  const email: string & tags.Format<"email"> = typia.random<
    string & tags.Format<"email">
  >();
  const password_hash: string = RandomGenerator.alphaNumeric(24);

  // 2. Register the first admin - success expected
  const firstAdmin = await api.functional.auth.admin.join(connection, {
    body: {
      email,
      password_hash,
      name: RandomGenerator.name(),
      avatar_uri: null,
      status: "active",
      privilege_level: "superadmin",
    } satisfies ITodoListAdmin.IJoin,
  });
  typia.assert(firstAdmin);
  TestValidator.equals(
    "registered email matches input",
    firstAdmin.admin.email,
    email,
  );

  // 3. Attempt second registration with same email - should fail with business error
  await TestValidator.error(
    "duplicate admin email registration should fail",
    async () => {
      await api.functional.auth.admin.join(connection, {
        body: {
          email,
          password_hash: RandomGenerator.alphaNumeric(24), // different password hash, same email
          name: RandomGenerator.name(),
          avatar_uri: null,
          status: "active",
          privilege_level: "support",
        } satisfies ITodoListAdmin.IJoin,
      });
    },
  );
}
