import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";

export async function test_api_todo_creation_success(
  connection: api.IConnection,
) {
  /**
   * E2E test for successful todo creation by an authenticated user.
   *
   * Steps:
   *
   * 1. Register a user (random email/password)
   * 2. Verify the user email (simulate token extraction from registration)
   * 3. Login as verified user (set auth header)
   * 4. Create a todo (valid title, description, due_date)
   * 5. Assert response matches ITodoListTodo schema and business defaults.
   */

  // 1. Register a new user account
  const uniqueEmail = `${RandomGenerator.alphaNumeric(10)}@test-e2e.com`;
  const password = RandomGenerator.alphaNumeric(12);
  const registration = await api.functional.auth.user.join(connection, {
    body: {
      email: uniqueEmail,
      password: password,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(registration);

  // 2. Simulate email verification (in production, token would be sent to email)
  const verificationToken = registration.token.refresh;
  const userId = registration.user.id;
  const verifyResult = await api.functional.auth.user.verify_email.verifyEmail(
    connection,
    {
      body: {
        user_id: userId,
        token: verificationToken,
      } satisfies ITodoListUser.IVerifyEmail,
    },
  );
  typia.assert(verifyResult);

  // 3. Login using verified account
  const login = await api.functional.auth.user.login(connection, {
    body: {
      email: uniqueEmail,
      password: password,
    } satisfies ITodoListUser.ILogin,
  });
  typia.assert(login);
  TestValidator.equals(
    "login userId should match registered userId",
    login.user.id,
    userId,
  );
  TestValidator.equals(
    "login user email should match registered email",
    login.user.email,
    uniqueEmail,
  );

  // 4. Create a todo (title required, description/future due_date optional)
  const todoTitle = RandomGenerator.paragraph({ sentences: 2, wordMin: 4 });
  const todoDescription = RandomGenerator.paragraph({
    sentences: 5,
    wordMin: 4,
  });
  const futureDueDate = new Date(
    Date.now() + 3 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const todo = await api.functional.todoList.user.todos.create(connection, {
    body: {
      title: todoTitle,
      description: todoDescription,
      due_date: futureDueDate,
    } satisfies ITodoListTodo.ICreate,
  });
  typia.assert(todo);
  TestValidator.equals("todo title matches input", todo.title, todoTitle);
  TestValidator.equals(
    "todo description matches input",
    todo.description,
    todoDescription,
  );
  TestValidator.equals(
    "todo due_date matches input",
    todo.due_date,
    futureDueDate,
  );
  TestValidator.equals(
    "todo is_completed defaults to false",
    todo.is_completed,
    false,
  );
  TestValidator.equals(
    "todo completed_at is null for incomplete",
    todo.completed_at,
    null,
  );

  // 5. All fields present per ITodoListTodo type
  TestValidator.predicate(
    "todo id is valid uuid",
    typeof todo.id === "string" && /^[0-9a-fA-F-]{36}$/.test(todo.id),
  );
  TestValidator.predicate(
    "todo created_at is valid iso string",
    typeof todo.created_at === "string" && !isNaN(Date.parse(todo.created_at)),
  );
  TestValidator.predicate(
    "todo updated_at is valid iso string",
    typeof todo.updated_at === "string" && !isNaN(Date.parse(todo.updated_at)),
  );
}
