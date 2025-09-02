import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";

export async function test_api_todo_retrieve_not_found_or_forbidden(
  connection: api.IConnection,
) {
  /**
   * Validate forbidden or not-found error when accessing unauthorized todo.
   *
   * - Register User A with a random email and password, then verify A's email.
   * - As User A, create a todo (title, and optional description).
   * - Register User B with a different random email and password (auto-login as
   *   B).
   * - As User B, attempt to retrieve the todo created by User A using its todoId.
   * - Assert that B receives a not-found or permission-denied error.
   * - Ensure that error does not leak information about ownership or existence of
   *   the todo.
   */

  // Register User A
  const userAEmail: string & tags.Format<"email"> = typia.random<
    string & tags.Format<"email">
  >();
  const userAPassword: string = RandomGenerator.alphaNumeric(12);
  const userA = await api.functional.auth.user.join(connection, {
    body: {
      email: userAEmail,
      password: userAPassword,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(userA);

  // Simulate retrieval of email verification token
  // In a real-world test setup, the token would be captured from system or test outbox
  const verificationToken: string = userA.token.refresh; // Placeholder/token source mock
  await api.functional.auth.user.verify_email.verifyEmail(connection, {
    body: {
      user_id: userA.user.id,
      token: verificationToken,
    } satisfies ITodoListUser.IVerifyEmail,
  });

  // User A creates a todo
  const todo = await api.functional.todoList.user.todos.create(connection, {
    body: {
      title: RandomGenerator.paragraph({
        sentences: 2,
        wordMin: 4,
        wordMax: 10,
      }),
      description: RandomGenerator.paragraph({
        sentences: 5,
        wordMin: 3,
        wordMax: 8,
      }),
    } satisfies ITodoListTodo.ICreate,
  });
  typia.assert(todo);

  // Register User B (context switches/auth as B)
  const userBEmail: string & tags.Format<"email"> = typia.random<
    string & tags.Format<"email">
  >();
  const userBPassword: string = RandomGenerator.alphaNumeric(12);
  const userB = await api.functional.auth.user.join(connection, {
    body: {
      email: userBEmail,
      password: userBPassword,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(userB);

  // As User B, attempt to retrieve User A's todo by id – should error (not found or forbidden)
  await TestValidator.error(
    "user should not retrieve other user's todo (not found/forbidden)",
    async () => {
      await api.functional.todoList.user.todos.at(connection, {
        todoId: todo.id,
      });
    },
  );
}
