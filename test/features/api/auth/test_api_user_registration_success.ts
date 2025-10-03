import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Test user registration workflow for the minimal Todo list app.
 *
 * This test exercises the user registration flow via POST /auth/user/join. It
 * verifies that a unique email and a strong password can register successfully
 * and that the returned value includes fully valid user and authentication
 * properties. It also checks that duplicate registration attempts fail with the
 * same email, but a new account can be created with a different email.
 *
 * 1. Generate a random, unique email and password.
 * 2. Register a user with those credentials; expect success.
 * 3. Validate that the result matches ITodoListUser.IAuthorized:
 *
 *    - Id is a UUID
 *    - Email matches input
 *    - Date fields are proper ISO strings
 *    - Token is an IAuthorizationToken with all required fields and proper formats
 * 4. Attempt to register again with the same email; expect failure.
 * 5. Register another account with a different unique email; expect success.
 */
export async function test_api_user_registration_success(
  connection: api.IConnection,
) {
  // 1. Generate unique credentials
  const uniqueEmail1 = typia.random<
    string & tags.MaxLength<255> & tags.Format<"email">
  >();
  const password = RandomGenerator.alphaNumeric(12);

  // 2. Register user (should succeed)
  const authorized1 = await api.functional.auth.user.join(connection, {
    body: {
      email: uniqueEmail1,
      password,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(authorized1);
  TestValidator.equals(
    "registered email matches input",
    authorized1.email,
    uniqueEmail1,
  );

  // 3. Verify ITodoListUser.IAuthorized structure
  typia.assert<ITodoListUser.IAuthorized>(authorized1);
  TestValidator.predicate(
    "authorized1.id is uuid",
    typeof authorized1.id === "string" && authorized1.id.length > 0,
  );
  TestValidator.predicate(
    "authorized1.created_at is ISO string",
    !isNaN(Date.parse(authorized1.created_at)),
  );
  TestValidator.predicate(
    "authorized1.updated_at is ISO string",
    !isNaN(Date.parse(authorized1.updated_at)),
  );
  typia.assert<IAuthorizationToken>(authorized1.token);
  TestValidator.predicate(
    "token.access present",
    typeof authorized1.token.access === "string" &&
      authorized1.token.access.length > 0,
  );
  TestValidator.predicate(
    "token.refresh present",
    typeof authorized1.token.refresh === "string" &&
      authorized1.token.refresh.length > 0,
  );
  TestValidator.predicate(
    "token.expired_at is ISO string",
    !isNaN(Date.parse(authorized1.token.expired_at)),
  );
  TestValidator.predicate(
    "token.refreshable_until is ISO string",
    !isNaN(Date.parse(authorized1.token.refreshable_until)),
  );

  // 4. Attempt duplicate registration (should fail)
  await TestValidator.error(
    "registering with duplicate email fails",
    async () => {
      await api.functional.auth.user.join(connection, {
        body: {
          email: uniqueEmail1,
          password: RandomGenerator.alphaNumeric(12),
        } satisfies ITodoListUser.IJoin,
      });
    },
  );

  // 5. Register with another unique email (should succeed)
  const uniqueEmail2 = typia.random<
    string & tags.MaxLength<255> & tags.Format<"email">
  >();
  const authorized2 = await api.functional.auth.user.join(connection, {
    body: {
      email: uniqueEmail2,
      password: RandomGenerator.alphaNumeric(12),
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(authorized2);
  TestValidator.equals(
    "second registered email matches input",
    authorized2.email,
    uniqueEmail2,
  );
}
