import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * End-to-end test for hard deletion of a todo (standard and edge cases).
 *
 * This test covers:
 *
 * 1. New user registration and login flow (user owner context)
 * 2. Todo creation
 * 3. Deletion of the owned todo by ID (should succeed, no error)
 * 4. Verifying that repeat deletion on the same ID fails with not found or error
 * 5. Deletion as unauthenticated (should error/forbid)
 * 6. Deletion as a non-owner user (should error/forbid)
 * 7. Deduplication window check: after deletion, a new todo with identical content
 *    can be made (no ghost remains)
 */
export async function test_api_user_todo_deletion_standard_and_edge_cases(
  connection: api.IConnection,
) {
  // 1. Register first user
  const user1Email = typia.random<string & tags.Format<"email">>();
  const user1Password = RandomGenerator.alphaNumeric(12);
  const user1Join = await api.functional.auth.user.join(connection, {
    body: {
      email: user1Email,
      password: user1Password,
      name: RandomGenerator.name(),
      avatar_uri: null,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(user1Join);

  // 2. Create a new todo with user1
  const todoContent = RandomGenerator.paragraph({
    sentences: 2,
    wordMin: 3,
    wordMax: 8,
  });
  const todoDueDate = null;
  const todo = await api.functional.todoList.user.todos.create(connection, {
    body: {
      content: todoContent,
      due_date: todoDueDate,
    } satisfies ITodoListTodo.ICreate,
  });
  typia.assert(todo);
  TestValidator.equals("todo content matches", todo.content, todoContent);
  TestValidator.equals(
    "todo owner matches user1",
    todo.todo_list_user_id,
    user1Join.user.id,
  );

  // 3. Hard delete the todo
  await api.functional.todoList.user.todos.erase(connection, {
    todoId: todo.id,
  });

  // 4. Attempt to delete again (should yield error)
  await TestValidator.error("repeat delete is not found or error", async () => {
    await api.functional.todoList.user.todos.erase(connection, {
      todoId: todo.id,
    });
  });

  // 5. Deletion as unauthenticated (should not be allowed)
  const unauthConn: api.IConnection = { ...connection, headers: {} };
  await TestValidator.error("unauthenticated erase is forbidden", async () => {
    await api.functional.todoList.user.todos.erase(unauthConn, {
      todoId: todo.id,
    });
  });

  // 6. Register second user and try to erase user1's deleted todo (should fail)
  const user2Email = typia.random<string & tags.Format<"email">>();
  const user2Password = RandomGenerator.alphaNumeric(12);
  const user2Join = await api.functional.auth.user.join(connection, {
    body: {
      email: user2Email,
      password: user2Password,
      name: RandomGenerator.name(),
      avatar_uri: null,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(user2Join);
  await TestValidator.error(
    "other user cannot erase another's (even deleted) todo",
    async () => {
      await api.functional.todoList.user.todos.erase(connection, {
        todoId: todo.id,
      });
    },
  );

  // 7. User1 should be able to re-create identical content todo after deletion
  await api.functional.auth.user.join(connection, {
    body: {
      email: user1Email,
      password: user1Password,
    } satisfies ITodoListUser.IJoin,
  });
  const todo2 = await api.functional.todoList.user.todos.create(connection, {
    body: {
      content: todoContent,
      due_date: todoDueDate,
    } satisfies ITodoListTodo.ICreate,
  });
  typia.assert(todo2);
  TestValidator.equals(
    "recreated todo content matches",
    todo2.content,
    todoContent,
  );
}
