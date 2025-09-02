import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";

export async function test_api_todo_update_duplicate_title_error(
  connection: api.IConnection,
) {
  /**
   * Test error when updating a todo's title to match another of the user's
   * active todos, violating the per-user incomplete-title uniqueness
   * constraint.
   *
   * 1. Register a unique user (random email/password).
   * 2. Verify the email to enable login.
   * 3. Login as the user (ensure Authorization context is set).
   * 4. Create the first todo with a unique title.
   * 5. Create a second todo with a different title (both incomplete).
   * 6. Attempt to update the second todo's title to match the first's.
   * 7. Assert that the API rejects with a validation error (duplicate title).
   */

  // 1. Register a unique user
  const userEmail: string = typia.random<string & tags.Format<"email">>();
  const userPassword: string = RandomGenerator.alphaNumeric(12);
  const joinRes = await api.functional.auth.user.join(connection, {
    body: {
      email: userEmail,
      password: userPassword,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(joinRes);

  // 2. Verify the user's email
  // Normally, verification token would be delivered by out-of-band email. Here, use the returned token directly
  await api.functional.auth.user.verify_email.verifyEmail(connection, {
    body: {
      user_id: joinRes.user.id,
      token: joinRes.token.refresh,
    } satisfies ITodoListUser.IVerifyEmail,
  });

  // 3. Login as the user
  const loginRes = await api.functional.auth.user.login(connection, {
    body: {
      email: userEmail,
      password: userPassword,
    } satisfies ITodoListUser.ILogin,
  });
  typia.assert(loginRes);

  // 4. Create the first todo (A) with a unique title
  const todoTitleA = RandomGenerator.paragraph({
    sentences: 3,
    wordMin: 4,
    wordMax: 8,
  });
  const todoA = await api.functional.todoList.user.todos.create(connection, {
    body: {
      title: todoTitleA,
      description: RandomGenerator.paragraph({
        sentences: 5,
        wordMin: 5,
        wordMax: 10,
      }),
    } satisfies ITodoListTodo.ICreate,
  });
  typia.assert(todoA);
  TestValidator.equals("todo A has correct title", todoA.title, todoTitleA);

  // 5. Create the second todo (B) with a different title
  let todoTitleB: string = todoTitleA;
  while (todoTitleB === todoTitleA) {
    // Ensure not (by business rule, 1-255 chars, unique per user)
    todoTitleB = RandomGenerator.paragraph({
      sentences: 4,
      wordMin: 4,
      wordMax: 9,
    });
  }
  const todoB = await api.functional.todoList.user.todos.create(connection, {
    body: {
      title: todoTitleB,
      description: RandomGenerator.paragraph({
        sentences: 4,
        wordMin: 5,
        wordMax: 10,
      }),
    } satisfies ITodoListTodo.ICreate,
  });
  typia.assert(todoB);
  TestValidator.equals("todo B has correct title", todoB.title, todoTitleB);

  // 6. Attempt to update todo B's title to match todo A's (should fail)
  await TestValidator.error(
    "updating todo B's title to duplicate todo A's should trigger a business validation error",
    async () => {
      await api.functional.todoList.user.todos.update(connection, {
        todoId: todoB.id,
        body: { title: todoTitleA } satisfies ITodoListTodo.IUpdate,
      });
    },
  );
}
