import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { HttpException } from "@nestjs/common";
import { ITodoListAuditLog } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAuditLog";
import { IPageITodoListAuditLog } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListAuditLog";
import { AdminPayload } from "../decorators/payload/AdminPayload";

/**
 * Retrieve a filtered, paginated list of audit log entries from
 * todo_list_audit_logs (admin only).
 *
 * This operation allows admin users to search, filter, sort, and paginate
 * admin-audited actions on user todos. It supports filtering by acting admin,
 * affected user, target todo, action type, rationale keyword, created_at time
 * range, and flexible sort and paging options. Only admins may access this
 * endpoint.
 *
 * @param props - Parameters object containing:
 *
 *   - Admin: Authenticated AdminPayload
 *   - Body: ITodoListAuditLog.IRequest filter/search structure
 *
 * @returns Paginated list result with matching audit log summaries
 * @throws {HttpException} 403 Forbidden if not called as admin
 */
export async function patchtodoListAdminAuditLogs(props: {
  admin: AdminPayload;
  body: ITodoListAuditLog.IRequest;
}): Promise<IPageITodoListAuditLog.ISummary> {
  const { admin, body } = props;
  // Authorization check - required by contract
  if (!admin || admin.type !== "admin") {
    throw new HttpException("Forbidden: Admin authentication required", 403);
  }

  // Pagination defaults/limits
  const safePage = body.page != null && body.page >= 1 ? body.page : 1;
  const safeLimit =
    body.limit != null && body.limit >= 1 && body.limit <= 100
      ? body.limit
      : 20;
  const skip = (safePage - 1) * safeLimit;
  // Allowed sort fields
  const ALLOWED_SORT: Record<string, true> = {
    created_at: true,
    action: true,
    todo_list_admin_id: true,
    todo_list_user_id: true,
    todo_list_todo_id: true,
  };
  // Default sort by created_at desc
  const sortField =
    typeof body.sort === "string" && ALLOWED_SORT[body.sort]
      ? body.sort
      : "created_at";
  const sortDirection: "asc" | "desc" =
    body.direction === "asc" || body.direction === "desc"
      ? body.direction
      : "desc";

  // Build Prisma where filter, handling nullable/optional fields vs required
  const where = {
    ...(body.todo_list_admin_id !== undefined &&
      body.todo_list_admin_id !== null && {
        todo_list_admin_id: body.todo_list_admin_id,
      }),
    ...(body.todo_list_user_id !== undefined &&
      body.todo_list_user_id !== null && {
        todo_list_user_id: body.todo_list_user_id,
      }),
    ...(body.todo_list_todo_id !== undefined &&
      body.todo_list_todo_id !== null && {
        todo_list_todo_id: body.todo_list_todo_id,
      }),
    ...(body.action !== undefined &&
      body.action !== null && { action: body.action }),
    ...(body.rationale !== undefined &&
      body.rationale !== null && { rationale: { contains: body.rationale } }),
    ...((body.from !== undefined && body.from !== null) ||
    (body.to !== undefined && body.to !== null)
      ? {
          created_at: {
            ...(body.from !== undefined &&
              body.from !== null && { gte: body.from }),
            ...(body.to !== undefined && body.to !== null && { lte: body.to }),
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    MyGlobal.prisma.todo_list_audit_logs.findMany({
      where,
      orderBy: { [sortField]: sortDirection },
      skip,
      take: safeLimit,
    }),
    MyGlobal.prisma.todo_list_audit_logs.count({ where }),
  ]);

  const data = rows.map((row) => ({
    id: row.id,
    todo_list_admin_id: row.todo_list_admin_id,
    todo_list_user_id: row.todo_list_user_id,
    todo_list_todo_id: row.todo_list_todo_id,
    action: row.action === "view" ? "view" : "delete",
    rationale: row.rationale ?? undefined,
    created_at: toISOStringSafe(row.created_at),
  }));

  return {
    pagination: {
      current: Number(safePage),
      limit: Number(safeLimit),
      records: total,
      pages: Math.ceil(total / (safeLimit || 1)),
    },
    data,
  };
}
