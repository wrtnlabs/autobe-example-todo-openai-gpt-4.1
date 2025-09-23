import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { IPage } from "@ORGANIZATION/PROJECT-api/lib/structures/IPage";
import type { IPageITodoListAuditLog } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListAuditLog";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import type { ITodoListAuditLog } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAuditLog";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Validate admin audit log search and filter functionality for todo actions in
 * the system.
 *
 * This test ensures:
 *
 * 1. Admin can register and log in
 * 2. User can register and log in
 * 3. User creates a todo
 * 4. Admin deletes user's todo (generates audit log)
 * 5. Admin can query audit logs filtered by adminId, userId, and todoId, and
 *    result includes the generated entry
 * 6. Returned log entry matches the correct metadata (adminId, userId, todoId,
 *    action, rationale, timestamp)
 * 7. Filtering with invalid combinations (nonexistent adminId, userId, or todoId)
 *    yields no results
 * 8. Unauthorized (non-admin or unauthenticated) user cannot access audit log
 *    search (expects error)
 */
export async function test_api_admin_audit_log_search_for_todo_actions(
  connection: api.IConnection,
) {
  // 1. Register & authenticate as admin
  const adminJoin = {
    email: typia.random<string & tags.Format<"email">>(),
    password_hash: RandomGenerator.alphaNumeric(12),
    name: RandomGenerator.name(),
    avatar_uri: null,
    privilege_level: "support",
    status: "active",
  } satisfies ITodoListAdmin.IJoin;
  const adminAuth = await api.functional.auth.admin.join(connection, {
    body: adminJoin,
  });
  typia.assert(adminAuth);
  const adminId = adminAuth.id;

  // 2. Register & authenticate as user
  const userJoin = {
    email: typia.random<string & tags.Format<"email">>(),
    password: RandomGenerator.alphaNumeric(12),
    name: RandomGenerator.name(),
    avatar_uri: null,
  } satisfies ITodoListUser.IJoin;
  const userAuth = await api.functional.auth.user.join(connection, {
    body: userJoin,
  });
  typia.assert(userAuth);
  const userId = userAuth.id;

  // 3. User creates a todo
  await api.functional.auth.user.join(connection, { body: userJoin }); // context switch
  const todoBody = {
    content: RandomGenerator.paragraph({
      sentences: 3,
      wordMin: 5,
      wordMax: 10,
    }),
  } satisfies ITodoListTodo.ICreate;
  const todo = await api.functional.todoList.user.todos.create(connection, {
    body: todoBody,
  });
  typia.assert(todo);
  const todoId = todo.id;

  // 4. Admin deletes user's todo (must context switch to admin)
  await api.functional.auth.admin.join(connection, { body: adminJoin }); // context switch
  await api.functional.todoList.admin.todos.erase(connection, { todoId });

  // 5. Admin queries audit logs filtered by all keys (adminId, userId, todoId)
  const logsRes = await api.functional.todoList.admin.auditLogs.index(
    connection,
    {
      body: {
        todo_list_admin_id: adminId,
        todo_list_user_id: userId,
        todo_list_todo_id: todoId,
        action: "delete",
        page: 1,
        limit: 10,
      } satisfies ITodoListAuditLog.IRequest,
    },
  );
  typia.assert(logsRes);
  TestValidator.predicate(
    "should include at least one audit log for admin delete action on this todo,user",
    logsRes.data.some(
      (entry) =>
        entry.todo_list_admin_id === adminId &&
        entry.todo_list_user_id === userId &&
        entry.todo_list_todo_id === todoId &&
        entry.action === "delete",
    ),
  );

  // 6. Log entry fields correctness
  const auditEntry = logsRes.data.find(
    (l) =>
      l.todo_list_admin_id === adminId &&
      l.todo_list_user_id === userId &&
      l.todo_list_todo_id === todoId,
  );
  if (auditEntry) {
    TestValidator.equals("action is delete", auditEntry.action, "delete");
    typia.assert<ITodoListAuditLog.ISummary>(auditEntry);
  } else {
    throw new Error("Audit log for deleted todo not found");
  }

  // 7. Filtering with invalid (random) ids yields no results
  const invalidFilterRes = await api.functional.todoList.admin.auditLogs.index(
    connection,
    {
      body: {
        todo_list_admin_id: typia.random<string & tags.Format<"uuid">>(),
        todo_list_user_id: typia.random<string & tags.Format<"uuid">>(),
        todo_list_todo_id: typia.random<string & tags.Format<"uuid">>(),
        action: "view",
        page: 1,
        limit: 5,
      } satisfies ITodoListAuditLog.IRequest,
    },
  );
  typia.assert(invalidFilterRes);
  TestValidator.equals(
    "empty audit log result for invalid filter",
    invalidFilterRes.data.length,
    0,
  );

  // 8. Attempt as unauthorized/unauthenticated: clear admin session => expect forbidden
  const unauthConn: api.IConnection = { ...connection, headers: {} };
  await TestValidator.error(
    "audit log search forbidden for unauthenticated/unauthorized user",
    async () => {
      await api.functional.todoList.admin.auditLogs.index(unauthConn, {
        body: {
          todo_list_admin_id: adminId,
          action: "delete",
        } satisfies ITodoListAuditLog.IRequest,
      });
    },
  );
}
