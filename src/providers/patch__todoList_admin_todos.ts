import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListTodos } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodos";
import { IPageITodoListTodos } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListTodos";
import { AdminPayload } from "../decorators/payload/AdminPayload";

/**
 * Search, filter, and paginate todo items for the authenticated user (or admin
 * for all users) from the todo_list_todos table.
 *
 * This function allows an authenticated admin user to retrieve, filter, and
 * paginate todo items system-wide. Filters and pagination options are provided
 * in the body parameter. Response includes summaries with required status and
 * timestamp metadata, with all business rules enforced according to admin
 * authorization.
 *
 * @param props - The request payload containing admin authentication and
 *   search/filter options
 * @param props.admin - The authenticated Administrator user. Must have proper
 *   admin payload.
 * @param props.body - Filtering, search, sorting, and pagination options; all
 *   fields optional.
 * @returns Paginated list of todo summaries and pagination info.
 * @throws {Error} If any database operation fails or input is outside expected
 *   bounds
 */
export async function patch__todoList_admin_todos(props: {
  admin: AdminPayload;
  body: ITodoListTodos.IRequest;
}): Promise<IPageITodoListTodos.ISummary> {
  const { body } = props;
  const {
    is_completed,
    due_date_from,
    due_date_to,
    search,
    sort_by,
    sort_order,
    page,
    limit,
  } = body || {};

  // Allow only whitelisted fields for sorting
  const allowedSortFields = ["created_at", "due_date", "is_completed"] as const;
  const sortField =
    allowedSortFields.includes(sort_by as any) && sort_by
      ? sort_by
      : "created_at";
  const sortDirection = sort_order === "asc" ? "asc" : "desc";
  // Clamp limit (1..100)
  const safeLimit = limit != null ? Math.max(1, Math.min(100, limit)) : 20;
  const safePage = page != null ? Math.max(1, page) : 1;
  const skip = (safePage - 1) * safeLimit;

  // Build where clause with only verified fields (record type avoided for type safety)
  const where = {
    ...(typeof is_completed === "boolean" && { is_completed }),
    ...(due_date_from != null || due_date_to != null
      ? {
          due_date: {
            ...(due_date_from != null && { gte: due_date_from }),
            ...(due_date_to != null && { lte: due_date_to }),
          },
        }
      : {}),
    ...(search && search.length > 0
      ? {
          OR: [
            { title: { contains: search } },
            { description: { contains: search } },
          ],
        }
      : {}),
  };

  // Compose query and count in parallel
  const [rows, total] = await Promise.all([
    MyGlobal.prisma.todo_list_todos.findMany({
      where,
      orderBy: { [sortField]: sortDirection },
      skip,
      take: safeLimit,
    }),
    MyGlobal.prisma.todo_list_todos.count({ where }),
  ]);

  // Map fields to ISummary format with required date conversions and strict types
  const data: ITodoListTodos.ISummary[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    is_completed: row.is_completed,
    due_date: row.due_date ? toISOStringSafe(row.due_date) : undefined,
    completed_at: row.completed_at
      ? toISOStringSafe(row.completed_at)
      : undefined,
    created_at: toISOStringSafe(row.created_at),
    updated_at: toISOStringSafe(row.updated_at),
  }));

  // Pagination calculation
  const pages = safeLimit > 0 ? Math.ceil(total / safeLimit) : 0;

  return {
    pagination: {
      current: Number(safePage),
      limit: Number(safeLimit),
      records: total,
      pages: pages,
    },
    data,
  };
}
