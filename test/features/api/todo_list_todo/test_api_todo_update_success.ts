import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";

/**
 * Test successful updating of a user's todo item by the item owner.
 *
 * 1. Register a user (POST /auth/user/join)
 * 2. Verify their email (POST /auth/user/verify-email)
 * 3. Log in (POST /auth/user/login)
 * 4. Create a todo item (POST /todoList/user/todos)
 * 5. Update the todo's title, description, due_date, and is_completed fields
 *    (PUT /todoList/user/todos/{todoId}), marking it as completed and
 *    setting all possible fields
 * 6. Confirm the API returns an object reflecting the updated values, and
 *    these persist if the todo is re-queried
 */
export async function test_api_todo_update_success(
  connection: api.IConnection,
) {
  // 1. Register user
  const email = typia.random<string & tags.Format<"email">>();
  const password = RandomGenerator.alphaNumeric(12);
  const joinResult = await api.functional.auth.user.join(connection, {
    body: { email, password } satisfies ITodoListUser.IJoin,
  });
  typia.assert(joinResult);
  const userId = joinResult.user.id;
  const verifyToken = joinResult.token.access;

  // 2. Email verification
  await api.functional.auth.user.verify_email.verifyEmail(connection, {
    body: {
      user_id: userId,
      token: verifyToken,
    } satisfies ITodoListUser.IVerifyEmail,
  });

  // 3. Log in after verifying email
  await api.functional.auth.user.login(connection, {
    body: { email, password } satisfies ITodoListUser.ILogin,
  });

  // 4. Create a todo
  const createRequest: ITodoListTodo.ICreate = {
    title: RandomGenerator.paragraph({ sentences: 2 }),
    description: RandomGenerator.paragraph({ sentences: 3 }),
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    is_completed: false,
  };
  const todo = await api.functional.todoList.user.todos.create(connection, {
    body: createRequest satisfies ITodoListTodo.ICreate,
  });
  typia.assert(todo);

  // 5. Update the todo fields
  const now = new Date();
  const updateRequest: ITodoListTodo.IUpdate = {
    title: RandomGenerator.paragraph({ sentences: 3 }),
    description: RandomGenerator.paragraph({ sentences: 5 }),
    due_date: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14).toISOString(),
    is_completed: true,
  };
  const updated = await api.functional.todoList.user.todos.update(connection, {
    todoId: todo.id,
    body: updateRequest satisfies ITodoListTodo.IUpdate,
  });
  typia.assert(updated);

  // 6. Assert updated fields
  TestValidator.equals(
    "updated title persisted",
    updated.title,
    updateRequest.title,
  );
  TestValidator.equals(
    "updated description persisted",
    updated.description,
    updateRequest.description,
  );
  TestValidator.equals(
    "updated due_date persisted",
    updated.due_date,
    updateRequest.due_date,
  );
  TestValidator.equals("is_completed set as true", updated.is_completed, true);
  TestValidator.predicate(
    "completed_at set after marking completed",
    typeof updated.completed_at === "string" && !!updated.completed_at,
  );
}
