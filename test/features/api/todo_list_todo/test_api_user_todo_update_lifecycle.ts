import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * This test verifies the update lifecycle of a user-owned todo in the
 * /todoList/user/todos/{todoId} API. It covers registration, todo creation,
 * various valid and invalid update flows, field-specific business validation,
 * and ownership/authorization enforcement.
 *
 * Test plan:
 *
 * 1. Register a new user via /auth/user/join (obtain JWT and user id)
 * 2. Create a todo item as this user via /todoList/user/todos (capture todoId)
 * 3. Update the todo's content with a normal valid string (1-255 non-whitespace
 *    chars, trimmed). Assert the change is reflected in the response.
 * 4. Update the todo's due date to a future date. Assert the due_date is updated
 *    in the response.
 * 5. Mark the todo completed (set completed=true). Assert completed_at is set.
 *    Then mark it incomplete and verify completed_at is reverted.
 * 6. Attempt updates with invalid content (whitespace, length <1, length >255).
 *    Expect business validation errors for each.
 * 7. Attempt to update using a random (nonexistent) todoId. Expect a not found or
 *    business error response.
 * 8. Register a second user, and try update with their account for the first
 *    user's todoId. Expect authorization error.
 * 9. For each update, verify that only allowed changes are reflected and all
 *    business rules are consistently enforced, and that unsuccessful changes
 *    leave the todo unchanged.
 */
export async function test_api_user_todo_update_lifecycle(
  connection: api.IConnection,
) {
  // 1. Register first user
  const email1 = typia.random<string & tags.Format<"email">>();
  const pass1 = RandomGenerator.alphaNumeric(9);
  const user1 = await api.functional.auth.user.join(connection, {
    body: {
      email: email1,
      password: pass1,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(user1);

  // 2. Create a todo as user1
  const baseContent = RandomGenerator.paragraph({
    sentences: 2,
    wordMin: 3,
    wordMax: 12,
  });
  const todo = await api.functional.todoList.user.todos.create(connection, {
    body: {
      content: baseContent,
    } satisfies ITodoListTodo.ICreate,
  });
  typia.assert(todo);
  TestValidator.equals(
    "created content equals input",
    todo.content,
    baseContent.trim(),
  );
  const todoId = todo.id;

  // Save for later
  let latest = todo;

  // 3. Valid content update + verify
  const newContent = RandomGenerator.paragraph({
    sentences: 3,
    wordMin: 4,
    wordMax: 10,
  });
  const updated1 = await api.functional.todoList.user.todos.update(connection, {
    todoId,
    body: {
      content: newContent,
    } satisfies ITodoListTodo.IUpdate,
  });
  typia.assert(updated1);
  TestValidator.equals("content updated", updated1.content, newContent.trim());
  TestValidator.notEquals("content changed", updated1.content, latest.content);

  // Check other fields unchanged
  TestValidator.equals(
    "due_date unchanged after content update",
    updated1.due_date,
    latest.due_date ?? null,
  );

  latest = updated1;

  // 4. Set due_date (future date)
  const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  const dueDateStr = new Date(future).toISOString().substring(0, 10);
  const updated2 = await api.functional.todoList.user.todos.update(connection, {
    todoId,
    body: {
      due_date: dueDateStr,
    } satisfies ITodoListTodo.IUpdate,
  });
  typia.assert(updated2);
  TestValidator.equals("due date updated", updated2.due_date, dueDateStr);
  latest = updated2;

  // 5a. Mark as completed
  const updated3 = await api.functional.todoList.user.todos.update(connection, {
    todoId,
    body: {
      completed: true,
    } satisfies ITodoListTodo.IUpdate,
  });
  typia.assert(updated3);
  TestValidator.equals("completed true", updated3.completed, true);
  TestValidator.predicate(
    "completed_at set",
    updated3.completed_at !== null && updated3.completed_at !== undefined,
  );

  // 5b. Mark as not completed
  const updated4 = await api.functional.todoList.user.todos.update(connection, {
    todoId,
    body: {
      completed: false,
    } satisfies ITodoListTodo.IUpdate,
  });
  typia.assert(updated4);
  TestValidator.equals("completed false", updated4.completed, false);
  TestValidator.predicate(
    "completed_at cleared",
    updated4.completed_at === null || updated4.completed_at === undefined,
  );
  latest = updated4;

  // 6. Invalid content: whitespace
  await TestValidator.error(
    "cannot update todo to whitespace content",
    async () => {
      await api.functional.todoList.user.todos.update(connection, {
        todoId,
        body: {
          content: "    ", // whitespace only
        } satisfies ITodoListTodo.IUpdate,
      });
    },
  );

  // 6b. Invalid content: empty string
  await TestValidator.error("cannot update todo to empty content", async () => {
    await api.functional.todoList.user.todos.update(connection, {
      todoId,
      body: {
        content: "",
      } satisfies ITodoListTodo.IUpdate,
    });
  });

  // 6c. Content too long (>255)
  await TestValidator.error(
    "cannot update todo to too long content",
    async () => {
      await api.functional.todoList.user.todos.update(connection, {
        todoId,
        body: {
          content: ArrayUtil.repeat(256, () => "a").join(""),
        } satisfies ITodoListTodo.IUpdate,
      });
    },
  );

  // 7. Update nonexistent todoId
  const randomTodoId = typia.random<string & tags.Format<"uuid">>();
  await TestValidator.error("updating non-existent todo fails", async () => {
    await api.functional.todoList.user.todos.update(connection, {
      todoId: randomTodoId,
      body: {
        content: RandomGenerator.paragraph({ sentences: 2 }),
      } satisfies ITodoListTodo.IUpdate,
    });
  });

  // 8. Register second user (join2)
  const email2 = typia.random<string & tags.Format<"email">>();
  const pass2 = RandomGenerator.alphaNumeric(9);
  const user2 = await api.functional.auth.user.join(connection, {
    body: {
      email: email2,
      password: pass2,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(user2);

  // Try update original todo as user2: should fail authz
  await TestValidator.error(
    "other user cannot update owner's todo",
    async () => {
      await api.functional.todoList.user.todos.update(connection, {
        todoId,
        body: {
          content: RandomGenerator.paragraph({ sentences: 2 }),
        } satisfies ITodoListTodo.IUpdate,
      });
    },
  );
}
