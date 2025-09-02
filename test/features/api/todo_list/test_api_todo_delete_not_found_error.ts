import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";

export async function test_api_todo_delete_not_found_error(
  connection: api.IConnection,
) {
  /**
   * Validate error on deletion attempt of a non-existent or unauthorized todo.
   *
   * This test ensures that, for an authenticated user:
   *
   * - Attempting to delete a todoId that does not exist (or does not belong to
   *   the user) returns a not-found or privacy-safe error.
   * - No resource leak occurs: the system reveals neither existence nor ownership
   *   details of the resource.
   * - No accidental deletion occurs. "/todoList/user/todos/:todoId" is a
   *   destructive endpoint, so correct authorization and existence checks are
   *   mandatory.
   *
   * Test Workflow:
   *
   * 1. Register a new user with valid email and secure password.
   * 2. Simulate email verification for the new account.
   * 3. Log in the user to ensure proper JWT token setup.
   * 4. Attempt to delete a randomly generated UUID as a todoId (guaranteed
   *    non-existent and not owned).
   * 5. Validate that the API call returns a not-found or privacy-safe error.
   */
  // 1. Register a new user
  const email = typia.random<string & tags.Format<"email">>();
  const password = RandomGenerator.alphaNumeric(12);
  const joinResult = await api.functional.auth.user.join(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(joinResult);
  const userId = joinResult.user.id;
  // 2. Email verification
  await api.functional.auth.user.verify_email.verifyEmail(connection, {
    body: {
      user_id: userId,
      token: RandomGenerator.alphaNumeric(32),
    } satisfies ITodoListUser.IVerifyEmail,
  });
  // 3. Login as user
  const loginResult = await api.functional.auth.user.login(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListUser.ILogin,
  });
  typia.assert(loginResult);
  // 4. Attempt to delete a non-existent todoId
  const fakeTodoId = typia.random<string & tags.Format<"uuid">>();
  await TestValidator.error(
    "should return privacy-safe not-found error when deleting non-existent todoId",
    async () => {
      await api.functional.todoList.user.todos.erase(connection, {
        todoId: fakeTodoId,
      });
    },
  );
}
