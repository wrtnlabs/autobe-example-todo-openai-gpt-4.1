import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";

export async function test_api_todo_creation_invalid_title_length(
  connection: api.IConnection,
) {
  /**
   * Test creation of todos with invalid title lengths and expect failure
   * according to business validation rules.
   *
   * Business context:
   *
   * - Todo title must be between 1 and 255 characters according to
   *   ITodoListTodo.ICreate and business rules.
   * - The API must reject creation of todos with invalid title lengths.
   *
   * Steps:
   *
   * 1. Register a user via /auth/user/join using unique random email and password
   *    (must meet DTO format/length requirements)
   * 2. Verify the user's email via /auth/user/verify-email with user_id and token
   *    (here, the token is simulated)
   * 3. Authenticate the user using /auth/user/login
   * 4. Attempt to create a todo with title = "" (zero length) – expect API
   *    validation error
   * 5. Attempt to create a todo with title length 256 (exceeding max) – expect API
   *    validation error
   * 6. Assert both errors occur (no todo created)
   *
   * No positive creation tests performed in this function.
   */

  // 1. Register a user meeting DTO/social/length/format requirements
  const email: string = `${RandomGenerator.alphabets(10)}@test.com`;
  const password: string = RandomGenerator.alphaNumeric(12);
  const joinResult = await api.functional.auth.user.join(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(joinResult);
  // Must have user id for email verification
  const userId: string = joinResult.user.id;

  // 2. Simulate/derive a verification token (in a real test, retrieve from test infra/mocked mail, here: random string)
  const verificationToken: string = typia.random<string>();
  await api.functional.auth.user.verify_email.verifyEmail(connection, {
    body: {
      user_id: userId,
      token: verificationToken,
    } satisfies ITodoListUser.IVerifyEmail,
  });

  // 3. Log in with email & password to set Authorization header for future calls
  const loginResult = await api.functional.auth.user.login(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListUser.ILogin,
  });
  typia.assert(loginResult);

  // 4. Attempt todo creation with empty title (violates minLength=1); must fail
  await TestValidator.error(
    "Creating a todo with an empty title should fail",
    async () => {
      await api.functional.todoList.user.todos.create(connection, {
        body: { title: "" } as any, // TypeScript will block satisfies, purposely using invalid input for negative test
      });
    },
  );

  // 5. Attempt todo creation with title > 255 chars (violates maxLength); must fail
  const tooLongTitle: string = RandomGenerator.alphabets(256);
  await TestValidator.error(
    "Creating a todo with a 256-character title should fail",
    async () => {
      await api.functional.todoList.user.todos.create(connection, {
        body: { title: tooLongTitle } as any, // purposely violating maxLength for negative scenario
      });
    },
  );
}
