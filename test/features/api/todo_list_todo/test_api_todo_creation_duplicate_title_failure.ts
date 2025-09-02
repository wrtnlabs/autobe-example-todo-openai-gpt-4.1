import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";

/**
 * Tests that users cannot create two active todos with the same title.
 *
 * This scenario validates that the system enforces a unique title
 * constraint per user for all active (incomplete) todos. It ensures that a
 * user cannot have more than one incomplete todo with the same title. The
 * test does this by registering a user, verifying their email,
 * authenticating, creating a todo, and then attempting to create a second
 * active todo using the exact same title. The second creation should fail
 * with a business logic error.
 *
 * Step-by-step:
 *
 * 1. Register a new user account (join)
 * 2. Verify the user email with the verification token
 * 3. Authenticate the user to obtain an access token
 * 4. Create a todo with a unique title (should succeed)
 * 5. Attempt to create a second active todo with the exact same title (should
 *    fail)
 * 6. Assert success/failure responses appropriately
 */
export async function test_api_todo_creation_duplicate_title_failure(
  connection: api.IConnection,
) {
  // 1. Register a new user (join)
  const email: string = typia.random<string & tags.Format<"email">>();
  const password: string = RandomGenerator.alphaNumeric(12);
  const userJoin = await api.functional.auth.user.join(connection, {
    body: { email, password } satisfies ITodoListUser.IJoin,
  });
  typia.assert(userJoin);

  // 2. Verify email immediately using test-generated token
  await api.functional.auth.user.verify_email.verifyEmail(connection, {
    body: {
      user_id: userJoin.user.id,
      token: typia.random<string>(),
    } satisfies ITodoListUser.IVerifyEmail,
  });

  // 3. Authenticate to obtain a usable session (token stored in connection)
  const login = await api.functional.auth.user.login(connection, {
    body: { email, password } satisfies ITodoListUser.ILogin,
  });
  typia.assert(login);

  // 4. Create a first active todo with a specific title
  const uniqueTitle: string = RandomGenerator.paragraph({
    sentences: 3,
    wordMin: 5,
    wordMax: 12,
  });
  const todo1 = await api.functional.todoList.user.todos.create(connection, {
    body: {
      title: uniqueTitle,
      description: RandomGenerator.paragraph({
        sentences: 5,
        wordMin: 8,
        wordMax: 16,
      }),
      is_completed: false,
    } satisfies ITodoListTodo.ICreate,
  });
  typia.assert(todo1);
  TestValidator.equals(
    "created todo title matches input",
    todo1.title,
    uniqueTitle,
  );

  // 5. Attempt duplicate active todo with the same title (should fail)
  await TestValidator.error(
    "duplicate active todo with same title should fail",
    async () => {
      await api.functional.todoList.user.todos.create(connection, {
        body: {
          title: uniqueTitle,
          description: RandomGenerator.paragraph({ sentences: 2 }),
        } satisfies ITodoListTodo.ICreate,
      });
    },
  );
}
