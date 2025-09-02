import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";

/**
 * Test successful deletion of a todo item by its owner.
 *
 * This test covers the full lifecycle of a user's todo:
 *
 * 1. User registration (random email & secure password generation)
 * 2. Email verification (simulates receiving and using a verification token)
 * 3. User login for authorization context
 * 4. Creation of a new todo item
 * 5. Permanent deletion of the created todo item
 * 6. Confirmation that deletion is effective by attempting a second deletion
 *    and validating an error is thrown
 *
 * The test ensures:
 *
 * - Proper authorization and authentication flows for the user
 * - Correct API request and response formatting and type safety
 * - That, once deleted, the todo cannot be deleted again (which implies it is
 *   no longer present for user retrieval)
 * - All TypeScript, business, and E2E testing requirements are respected
 */
export async function test_api_todo_delete_success(
  connection: api.IConnection,
) {
  // 1. Register a user
  const email: string = typia.random<string & tags.Format<"email">>();
  const password: string = RandomGenerator.alphaNumeric(12);
  const authorized = await api.functional.auth.user.join(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(authorized);

  // 2. Email verification (simulate receiving token from registration response)
  await api.functional.auth.user.verify_email.verifyEmail(connection, {
    body: {
      user_id: authorized.user.id,
      token: authorized.token.refresh,
    } satisfies ITodoListUser.IVerifyEmail,
  });

  // 3. Log in as the user (now email-verified)
  const login = await api.functional.auth.user.login(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListUser.ILogin,
  });
  typia.assert(login);

  // 4. Create a new todo item
  const todo = await api.functional.todoList.user.todos.create(connection, {
    body: {
      title: RandomGenerator.paragraph({
        sentences: 3,
        wordMin: 5,
        wordMax: 12,
      }),
      description: RandomGenerator.content({
        paragraphs: 1,
        sentenceMin: 2,
        sentenceMax: 4,
        wordMin: 3,
        wordMax: 8,
      }),
      is_completed: false,
      due_date: null,
    } satisfies ITodoListTodo.ICreate,
  });
  typia.assert(todo);

  // 5. Delete the todo by ID
  await api.functional.todoList.user.todos.erase(connection, {
    todoId: todo.id,
  });

  // 6. Attempting to delete the todo again must error
  await TestValidator.error(
    "deleting already-deleted todo should fail",
    async () => {
      await api.functional.todoList.user.todos.erase(connection, {
        todoId: todo.id,
      });
    },
  );
}
