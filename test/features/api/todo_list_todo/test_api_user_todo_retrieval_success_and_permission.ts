import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Validate per-user access and full field correctness for user todo retrieval.
 *
 * 1. Register user A
 * 2. Create todo as user A and retrieve its ID
 * 3. Retrieve todo by ID as user A, validate: content, due_date, completed,
 *    timestamps, todo_list_user_id, etc.
 * 4. Register user B and attempt to access user A's todo; expect forbidden error
 * 5. Attempt to access a random non-existent todoId, expect not-found error
 */
export async function test_api_user_todo_retrieval_success_and_permission(
  connection: api.IConnection,
) {
  // 1. Register user A
  const userAJoinInput = {
    email: typia.random<string & tags.Format<"email">>(),
    password: RandomGenerator.alphaNumeric(12),
    name: RandomGenerator.name(),
    avatar_uri: undefined,
  } satisfies ITodoListUser.IJoin;
  const userAAuth = await api.functional.auth.user.join(connection, {
    body: userAJoinInput,
  });
  typia.assert(userAAuth);
  const userAId = userAAuth.id;

  // 2. Create todo as user A
  const todoCreateInput = {
    content: RandomGenerator.paragraph({ sentences: 3 }),
    due_date: null,
  } satisfies ITodoListTodo.ICreate;
  const createdTodo = await api.functional.todoList.user.todos.create(
    connection,
    { body: todoCreateInput },
  );
  typia.assert(createdTodo);
  const todoId = createdTodo.id;

  // 3. Retrieve todo by ID as user A
  const retrievedTodo = await api.functional.todoList.user.todos.at(
    connection,
    { todoId },
  );
  typia.assert(retrievedTodo);
  TestValidator.equals("todo id matches", retrievedTodo.id, todoId);
  TestValidator.equals(
    "owner matches",
    retrievedTodo.todo_list_user_id,
    userAId,
  );
  TestValidator.equals(
    "content matches",
    retrievedTodo.content,
    todoCreateInput.content,
  );
  TestValidator.equals(
    "due_date matches",
    retrievedTodo.due_date,
    todoCreateInput.due_date,
  );
  TestValidator.predicate(
    "not completed by default",
    retrievedTodo.completed === false,
  );

  // 4. Register user B
  const userBJoinInput = {
    email: typia.random<string & tags.Format<"email">>(),
    password: RandomGenerator.alphaNumeric(12),
    name: RandomGenerator.name(),
    avatar_uri: undefined,
  } satisfies ITodoListUser.IJoin;
  const userBAuth = await api.functional.auth.user.join(connection, {
    body: userBJoinInput,
  });
  typia.assert(userBAuth);

  // Try to access userA's todo as user B
  await TestValidator.error(
    "forbidden: user B cannot access user A's todo",
    async () => {
      await api.functional.todoList.user.todos.at(connection, { todoId });
    },
  );

  // 5. Attempt to access a non-existent todoId
  await TestValidator.error(
    "not found: random todoId returns error",
    async () => {
      await api.functional.todoList.user.todos.at(connection, {
        todoId: typia.random<string & tags.Format<"uuid">>(),
      });
    },
  );
}
