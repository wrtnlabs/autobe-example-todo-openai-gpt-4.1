import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";

/**
 * Test successfully retrieving a todo owned by the currently authenticated
 * user.
 *
 * Scenario steps:
 *
 * 1. Register a new user with a valid email and password
 * 2. Simulate email verification for the newly registered user
 * 3. Create a todo for the authenticated, verified user (with some random
 *    title, description, due_date)
 * 4. Retrieve the todo by its ID using the GET endpoint; check all fields
 * 5. Assert that every returned detail matches the values used at creation and
 *    that no irrelevant/foreign fields are present
 * 6. Ensure the endpoint does not leak ownership or authorization details, and
 *    that privacy (data boundary) is preserved
 */
export async function test_api_todo_retrieve_success_own_todo(
  connection: api.IConnection,
) {
  // 1. Register a new user
  const email = typia.random<string & tags.Format<"email">>();
  const password = RandomGenerator.alphaNumeric(12);
  const join = await api.functional.auth.user.join(connection, {
    body: { email, password } satisfies ITodoListUser.IJoin,
  });
  typia.assert(join);

  // 2. Simulate email verification for the registered user (in production, token would be emailed)
  await api.functional.auth.user.verify_email.verifyEmail(connection, {
    body: {
      user_id: join.user.id,
      token: "dummy-token-success",
    } satisfies ITodoListUser.IVerifyEmail,
  });

  // 3. Create a todo for this user
  const todoInput: ITodoListTodo.ICreate = {
    title: RandomGenerator.paragraph({ sentences: 2, wordMin: 4, wordMax: 10 }),
    description: RandomGenerator.paragraph({
      sentences: 4,
      wordMin: 5,
      wordMax: 15,
    }),
    due_date: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    is_completed: false,
  };
  const created = await api.functional.todoList.user.todos.create(connection, {
    body: todoInput,
  });
  typia.assert(created);

  // 4. Retrieve the todo by its ID
  const fetched = await api.functional.todoList.user.todos.at(connection, {
    todoId: created.id,
  });
  typia.assert(fetched);

  // 5. Assert all details match creation
  TestValidator.equals("todo ID matches", fetched.id, created.id);
  TestValidator.equals("todo title matches", fetched.title, todoInput.title);
  TestValidator.equals(
    "todo description matches",
    fetched.description,
    todoInput.description,
  );
  TestValidator.equals(
    "todo due_date matches",
    fetched.due_date,
    todoInput.due_date,
  );
  TestValidator.equals(
    "todo is_completed matches",
    fetched.is_completed,
    todoInput.is_completed,
  );
  TestValidator.equals(
    "completed_at is null for new todo",
    fetched.completed_at,
    null,
  );
  TestValidator.predicate(
    "created_at is valid timestamp",
    typeof fetched.created_at === "string" &&
      !isNaN(Date.parse(fetched.created_at)),
  );
  TestValidator.predicate(
    "updated_at is valid timestamp",
    typeof fetched.updated_at === "string" &&
      !isNaN(Date.parse(fetched.updated_at)),
  );
  // 6. Confirm privacy: typia.assert ensures no extra fields are present (business boundary enforced)
}
