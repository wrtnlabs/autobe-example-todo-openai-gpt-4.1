import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";

export async function test_api_todo_update_invalid_todoid_not_found(
  connection: api.IConnection,
) {
  /**
   * Validate error response when updating a todo not owned by the authenticated
   * user or not existing.
   *
   * Steps:
   *
   * 1. Register a user with random email and password (min 8 chars).
   * 2. Verify their email by simulating retrieval of user id and issuing a
   *    dummy/placeholder token (as token logic is not explicitly covered by
   *    available APIs).
   * 3. Log the user in using the registered credentials.
   * 4. Generate a random UUID representing a non-existent todoId.
   * 5. Attempt to update this todo with valid data using the authenticated
   *    context.
   * 6. Assert, using TestValidator.error, that the API call fails with either
   *    not-found or permission-denied error (as appropriate to
   *    implementation).
   *
   * No successful modification should occur; test passes if error is detected
   * as expected.
   */

  // 1. Register new user
  const email = typia.random<string & tags.Format<"email">>();
  const password = RandomGenerator.alphaNumeric(12); // 12 chars, valid by DTO
  const joinResult = await api.functional.auth.user.join(connection, {
    body: {
      email,
      password: password as string & tags.MinLength<8> & tags.MaxLength<128>,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(joinResult);

  // 2. Verify email (simulate, as only context ID/token available)
  await api.functional.auth.user.verify_email.verifyEmail(connection, {
    body: {
      user_id: joinResult.user.id,
      token: RandomGenerator.alphaNumeric(16), // random plausible verification token
    } satisfies ITodoListUser.IVerifyEmail,
  });

  // 3. Log in
  const loginResult = await api.functional.auth.user.login(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListUser.ILogin,
  });
  typia.assert(loginResult);

  // 4. Generate random non-existent todoId
  const invalidTodoId = typia.random<string & tags.Format<"uuid">>();

  // 5. Prepare a valid update payload
  const updatePayload: ITodoListTodo.IUpdate = {
    title: RandomGenerator.paragraph({ sentences: 2, wordMin: 4, wordMax: 16 }),
    description: RandomGenerator.paragraph({
      sentences: 4,
      wordMin: 4,
      wordMax: 16,
    }),
    is_completed: false,
    due_date: null,
  };

  // 6. Attempt update - expect error
  await TestValidator.error(
    "update should fail for non-existent or unauthorized todoId",
    async () => {
      await api.functional.todoList.user.todos.update(connection, {
        todoId: invalidTodoId,
        body: updatePayload,
      });
    },
  );
}
