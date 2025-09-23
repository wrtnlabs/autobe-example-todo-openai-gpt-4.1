import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Test E2E todo creation for a user, enforcing business rules, validation, and
 * constraints.
 *
 * 1. Register and authenticate a new user
 * 2. Create a valid todo (valid content, future due_date)
 * 3. Attempt duplicate creation (content duplication must be rejected)
 * 4. Attempt invalid content (too short, too long, whitespace-only)
 * 5. Attempt past due date (should fail)
 * 6. Attempt to create as different user (should fail if possible)
 * 7. Confirm success path result and deduplication holds
 */
export async function test_api_todo_creation_validation_and_constraints(
  connection: api.IConnection,
) {
  // 1. Register and authenticate a user
  const joinBody = {
    email: typia.random<string & tags.Format<"email">>(),
    password: RandomGenerator.alphaNumeric(10),
    name: RandomGenerator.name(),
    avatar_uri: undefined,
  } satisfies ITodoListUser.IJoin;
  const authorized = await api.functional.auth.user.join(connection, {
    body: joinBody,
  });
  typia.assert(authorized);
  const user = authorized.user;
  // 2. Create a valid todo
  const validContent = RandomGenerator.paragraph({
    sentences: 5,
    wordMin: 4,
    wordMax: 10,
  }).slice(0, 255);
  const dueDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 5)
    .toISOString()
    .slice(0, 10); // 5 days in future, YYYY-MM-DD
  const todoCreateBody = {
    content: validContent,
    due_date: dueDate,
  } satisfies ITodoListTodo.ICreate;
  const todo = await api.functional.todoList.user.todos.create(connection, {
    body: todoCreateBody,
  });
  typia.assert(todo);
  TestValidator.equals("todo.content === input", todo.content, validContent);
  TestValidator.equals("todo.due_date === input", todo.due_date, dueDate);
  TestValidator.equals("todo.completed === false", todo.completed, false);
  TestValidator.equals("owner matched", todo.todo_list_user_id, user.id);

  // 3. Attempt duplicate creation (deduplication logic)
  await TestValidator.error(
    "Duplicate todo same content should fail",
    async () => {
      await api.functional.todoList.user.todos.create(connection, {
        body: todoCreateBody,
      });
    },
  );

  // 4. Attempt invalid content
  // 4.1 whitespace-only
  const whitespaceBody = {
    content: "   \t\n  ",
    due_date: dueDate,
  } satisfies ITodoListTodo.ICreate;
  await TestValidator.error("Whitespace-only content rejected", async () => {
    await api.functional.todoList.user.todos.create(connection, {
      body: whitespaceBody,
    });
  });
  // 4.2 empty string
  const emptyBody = {
    content: "",
    due_date: dueDate,
  } satisfies ITodoListTodo.ICreate;
  await TestValidator.error("Empty content rejected", async () => {
    await api.functional.todoList.user.todos.create(connection, {
      body: emptyBody,
    });
  });
  // 4.3 too long
  const tooLongContent = RandomGenerator.paragraph({
    sentences: 70,
    wordMin: 4,
    wordMax: 10,
  });
  const longBody = {
    content: tooLongContent,
    due_date: dueDate,
  } satisfies ITodoListTodo.ICreate;
  await TestValidator.error("Too long content (>255) rejected", async () => {
    await api.functional.todoList.user.todos.create(connection, {
      body: longBody,
    });
  });

  // 5. Past due date
  const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 1)
    .toISOString()
    .slice(0, 10); // yesterday
  const pastDueBody = {
    content: RandomGenerator.paragraph({ sentences: 5 }),
    due_date: pastDate,
  } satisfies ITodoListTodo.ICreate;
  await TestValidator.error("Past due_date rejected", async () => {
    await api.functional.todoList.user.todos.create(connection, {
      body: pastDueBody,
    });
  });

  // 6. (If possible) As another user
  const hackerBody = {
    email: typia.random<string & tags.Format<"email">>(),
    password: RandomGenerator.alphaNumeric(10),
    name: RandomGenerator.name(),
    avatar_uri: undefined,
  } satisfies ITodoListUser.IJoin;
  const hackerAuthorized = await api.functional.auth.user.join(connection, {
    body: hackerBody,
  });
  typia.assert(hackerAuthorized);
  // Switch to hacker session
  // Since API works by credentials from connection, after join will set session as hacker
  // Try to re-create todo with same content as user should be deduplicated per-user, not globally
  const otherUserBody = {
    content: validContent,
    due_date: dueDate,
  } satisfies ITodoListTodo.ICreate;
  const hackerTodo = await api.functional.todoList.user.todos.create(
    connection,
    { body: otherUserBody },
  );
  typia.assert(hackerTodo);
  TestValidator.predicate(
    "hacker's owner != user's",
    hackerTodo.todo_list_user_id !== user.id,
  );

  // (If not allowed to submit as wrong user, this would have failed with error instead)
}
