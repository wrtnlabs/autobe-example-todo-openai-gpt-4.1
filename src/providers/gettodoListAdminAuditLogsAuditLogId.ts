import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { HttpException } from "@nestjs/common";
import { ITodoListAuditLog } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAuditLog";
import { AdminPayload } from "../decorators/payload/AdminPayload";

/**
 * Retrieve details of a specific audit log entry from todo_list_audit_logs
 * (admin only).
 *
 * This endpoint allows an admin to view a single, complete audit log entry
 * identified by its UUID in the todo_list_audit_logs table. The returned
 * details provide full visibility into the original admin action (view or
 * delete) upon a user's todo, including all metadata required for compliance,
 * root cause analysis, or resolving operational issues.
 *
 * The operation enforces that only users with the admin role have access.
 * Attempts to view a nonexistent or unauthorized audit log record result in an
 * error with an informative business-level message. Each access to a detailed
 * audit record may itself be logged for traceability, supporting the system's
 * comprehensive oversight requirements.
 *
 * @param props - Object containing admin authentication and the audit log ID
 * @param props.admin - The authenticated admin performing the query
 * @param props.auditLogId - The unique identifier (UUID) of the audit log entry
 *   to retrieve
 * @returns The full details of the specified audit log entry, matching
 *   ITodoListAuditLog structure
 * @throws {Error} If the audit log is not found or the admin is unauthorized
 */
export async function gettodoListAdminAuditLogsAuditLogId(props: {
  admin: AdminPayload;
  auditLogId: string & tags.Format<"uuid">;
}): Promise<ITodoListAuditLog> {
  const record = await MyGlobal.prisma.todo_list_audit_logs.findUniqueOrThrow({
    where: { id: props.auditLogId },
  });

  // Ensure action type only 'view' or 'delete' (per API type, strict mapping)
  if (record.action !== "view" && record.action !== "delete") {
    throw new HttpException("Invalid audit log action", 500);
  }

  return {
    id: record.id,
    todo_list_admin_id: record.todo_list_admin_id,
    todo_list_user_id: record.todo_list_user_id,
    todo_list_todo_id: record.todo_list_todo_id,
    action: record.action,
    rationale:
      record.rationale === undefined
        ? undefined
        : record.rationale === null
          ? null
          : record.rationale,
    created_at: toISOStringSafe(record.created_at),
  };
}
