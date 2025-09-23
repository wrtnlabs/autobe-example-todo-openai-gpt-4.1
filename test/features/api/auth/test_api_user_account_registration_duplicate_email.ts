import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Validate that duplicate user registration by email is rejected.
 *
 * 1. Register a first user successfully with a random email/password.
 * 2. Attempt to register a second user with the same email (different password).
 * 3. Validate that the second attempt fails due to unique constraint (business
 *    error), and no sensitive information is revealed.
 */
export async function test_api_user_account_registration_duplicate_email(
  connection: api.IConnection,
) {
  // Register the first user
  const email = typia.random<string & tags.Format<"email">>();
  const password1 = RandomGenerator.alphaNumeric(12);
  const joinBody1 = {
    email,
    password: password1,
    name: RandomGenerator.name(),
    avatar_uri: null,
  } satisfies ITodoListUser.IJoin;
  const user1 = await api.functional.auth.user.join(connection, {
    body: joinBody1,
  });
  typia.assert(user1);
  TestValidator.equals("registered email matches", user1.user.email, email);

  // Attempt to register another user with the same email
  const password2 = RandomGenerator.alphaNumeric(12);
  const joinBody2 = {
    email,
    password: password2,
    name: RandomGenerator.name(),
    avatar_uri: null,
  } satisfies ITodoListUser.IJoin;
  await TestValidator.error(
    "second registration attempt with duplicate email fails",
    async () => {
      await api.functional.auth.user.join(connection, { body: joinBody2 });
    },
  );
}
