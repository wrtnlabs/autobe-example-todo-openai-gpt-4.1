import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Validates updating a user's todo via admin endpoint, including permissions,
 * successful update, and error cases.
 *
 * 1. Register and login as admin (admin join)
 * 2. Register and login as user (user join)
 * 3. As user, create a todo
 * 4. As admin, update that todo (change content, completed state, due date)
 * 5. Validate changes applied correctly
 * 6. Confirm updated_at changed and other fields preserved (simulate audit via
 *    updated_at change, since direct audit log is not available)
 * 7. Attempt to update with random/nonexistent todoId (expect error)
 * 8. Try update as user (not admin) (expect error/forbidden)
 */
export async function test_api_admin_todo_update_with_full_audit_trail(
  connection: api.IConnection,
) {
  // 1. Register admin
  const adminEmail = typia.random<string & tags.Format<"email">>();
  const adminJoin = {
    email: adminEmail,
    password_hash: RandomGenerator.alphaNumeric(16),
    name: RandomGenerator.name(),
    avatar_uri: null,
    status: "active",
    privilege_level: "support",
  } satisfies ITodoListAdmin.IJoin;
  const adminAuth = await api.functional.auth.admin.join(connection, {
    body: adminJoin,
  });
  typia.assert(adminAuth);

  // 2. Register user
  const userEmail = typia.random<string & tags.Format<"email">>();
  const userJoin = {
    email: userEmail,
    password: RandomGenerator.alphaNumeric(16),
    name: RandomGenerator.name(),
    avatar_uri: null,
  } satisfies ITodoListUser.IJoin;
  const userAuth = await api.functional.auth.user.join(connection, {
    body: userJoin,
  });
  typia.assert(userAuth);

  // 3. As user, create a todo
  const userConnection: api.IConnection = { ...connection };
  userConnection.headers = { ...connection.headers };
  userConnection.headers.Authorization = userAuth.token.access;
  const todoContent = RandomGenerator.paragraph({ sentences: 2 });
  const todoDue = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const todoCreate = {
    content: todoContent,
    due_date: todoDue,
  } satisfies ITodoListTodo.ICreate;
  const createdTodo = await api.functional.todoList.user.todos.create(
    userConnection,
    { body: todoCreate },
  );
  typia.assert(createdTodo);

  // 4. As admin, update the todo
  connection.headers = { ...connection.headers };
  connection.headers.Authorization = adminAuth.token.access;
  const updateContent = RandomGenerator.paragraph({ sentences: 3 });
  const updateDue = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const updateBody = {
    content: updateContent,
    due_date: updateDue,
    completed: true,
  } satisfies ITodoListTodo.IUpdate;
  const updatedTodo = await api.functional.todoList.admin.todos.update(
    connection,
    {
      todoId: createdTodo.id,
      body: updateBody,
    },
  );
  typia.assert(updatedTodo);
  TestValidator.equals(
    "todo was updated: content",
    updatedTodo.content,
    updateContent,
  );
  TestValidator.equals(
    "todo was updated: due_date",
    updatedTodo.due_date,
    updateDue,
  );
  TestValidator.equals(
    "todo was updated: completed",
    updatedTodo.completed,
    true,
  );

  // 5. Confirm updated_at changed
  TestValidator.notEquals(
    "updated_at changed after update",
    updatedTodo.updated_at,
    createdTodo.updated_at,
  );

  // 6. Negative case: update with random/nonexistent todoId
  const nonExistTodoId = typia.random<string & tags.Format<"uuid">>();
  await TestValidator.error(
    "update with nonexistent todoId yields error",
    async () => {
      await api.functional.todoList.admin.todos.update(connection, {
        todoId: nonExistTodoId,
        body: updateBody,
      });
    },
  );

  // 7. Negative case: update as user (not admin)
  userConnection.headers.Authorization = userAuth.token.access;
  await TestValidator.error("update as user forbidden", async () => {
    await api.functional.todoList.admin.todos.update(userConnection, {
      todoId: createdTodo.id,
      body: updateBody,
    });
  });
}
