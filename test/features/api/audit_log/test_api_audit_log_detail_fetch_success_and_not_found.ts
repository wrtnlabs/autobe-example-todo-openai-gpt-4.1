import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { IPage } from "@ORGANIZATION/PROJECT-api/lib/structures/IPage";
import type { IPageITodoListAuditLog } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListAuditLog";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import type { ITodoListAuditLog } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAuditLog";

/**
 * Validate admin detail audit log fetch and not-found error scenario.
 *
 * 1. Register an admin via POST /auth/admin/join with randomized credentials.
 * 2. Query audit logs via PATCH /todoList/admin/auditLogs with default filter to
 *    locate at least one valid log.
 * 3. Fetch audit log detail by this ID and assert all fields (id, admin ref, user
 *    ref, todo ref, action, rationale, created_at) are present.
 * 4. Attempt to fetch a random (nonexistent) auditLogId to assert a business error
 *    response (not-found, no data leak).
 */
export async function test_api_audit_log_detail_fetch_success_and_not_found(
  connection: api.IConnection,
) {
  // 1. Register admin
  const joinInput = {
    email: typia.random<string & tags.Format<"email">>(),
    password_hash: RandomGenerator.alphaNumeric(16),
    name: RandomGenerator.name(),
  } satisfies ITodoListAdmin.IJoin;
  const adminAuth = await api.functional.auth.admin.join(connection, {
    body: joinInput,
  });
  typia.assert(adminAuth);

  // 2. Query at least one audit log
  const auditPage = await api.functional.todoList.admin.auditLogs.index(
    connection,
    {
      body: {}, // no filter (all data)
    },
  );
  typia.assert(auditPage);
  TestValidator.predicate(
    "audit log list has at least one entry",
    auditPage.data.length > 0,
  );
  const picked = auditPage.data[0];

  // 3. Fetch audit log detail and assert type
  const detail = await api.functional.todoList.admin.auditLogs.at(connection, {
    auditLogId: picked.id,
  });
  typia.assert(detail);
  TestValidator.equals("detail id matches", detail.id, picked.id);
  TestValidator.equals(
    "admin id matches",
    detail.todo_list_admin_id,
    picked.todo_list_admin_id,
  );
  TestValidator.equals(
    "user id matches",
    detail.todo_list_user_id,
    picked.todo_list_user_id,
  );
  TestValidator.equals(
    "todo id matches",
    detail.todo_list_todo_id,
    picked.todo_list_todo_id,
  );
  TestValidator.equals("action matches", detail.action, picked.action);
  TestValidator.equals("rationale matches", detail.rationale, picked.rationale);
  TestValidator.equals(
    "created_at matches",
    detail.created_at,
    picked.created_at,
  );

  // 4. Not found case: random UUID
  const randomId = typia.random<string & tags.Format<"uuid">>();
  await TestValidator.error(
    "fetching nonexistent audit log throws error",
    async () => {
      await api.functional.todoList.admin.auditLogs.at(connection, {
        auditLogId: randomId,
      });
    },
  );
}
