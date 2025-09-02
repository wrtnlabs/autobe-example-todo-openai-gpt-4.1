import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";

export async function test_api_user_join_duplicate_email_error(
  connection: api.IConnection,
) {
  /**
   * Test registration failure when attempting to register with an email address
   * that is already in use (case-insensitive check).
   *
   * Steps:
   *
   * 1. Register a user successfully with a unique random email
   * 2. Attempt to register again using the same email (same casing): Should fail
   * 3. Attempt to register using the same email, but with different casing: Should
   *    also fail
   *
   * Validates that the API enforces strict, case-insensitive uniqueness on user
   * email and blocks duplicate registration with a clear error.
   */
  // 1. Generate a random email and a valid password for registration
  const email: string = typia.random<string & tags.Format<"email">>();
  const password: string = RandomGenerator.alphaNumeric(12);

  // 2. Register user with random credentials (should succeed)
  const first = await api.functional.auth.user.join(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(first);
  TestValidator.equals(
    "created user email matches input",
    first.user.email,
    email,
  );

  // 3. Attempt to register with the same email (duplicate; same casing)
  await TestValidator.error(
    "duplicate email (same casing) should fail",
    async () => {
      await api.functional.auth.user.join(connection, {
        body: {
          email,
          password: RandomGenerator.alphaNumeric(14),
        } satisfies ITodoListUser.IJoin,
      });
    },
  );

  // 4. Attempt to register with same email but different casing (case-insensitive duplicate)
  const variantEmail = (() => {
    const [local, ...rest] = email.split("@");
    return `${local.toUpperCase()}@${rest.join("@")}`;
  })();
  await TestValidator.error(
    "duplicate email (different casing) should fail",
    async () => {
      await api.functional.auth.user.join(connection, {
        body: {
          email: variantEmail,
          password: RandomGenerator.alphaNumeric(15),
        } satisfies ITodoListUser.IJoin,
      });
    },
  );
}
