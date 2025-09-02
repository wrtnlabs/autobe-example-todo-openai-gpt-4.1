import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListDeletedTodoLog } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListDeletedTodoLog";
import { IPageITodoListDeletedTodoLog } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListDeletedTodoLog";
import { IPage } from "@ORGANIZATION/PROJECT-api/lib/structures/IPage";
import { UserPayload } from "../decorators/payload/UserPayload";

/**
 * Retrieve a paginated, filtered list of deleted todo logs for the
 * authenticated user.
 *
 * Provides paginated, search- and filter-enabled access to the user's deleted
 * todo audit logs (todo_list_deleted_todo_logs). Filters available include
 * deletion date range, completion status, and case-insensitive title text
 * search. Results are always scoped to the authenticated user's own records via
 * todo_list_user_id, enforcing privacy. Pagination and sorting (by deleted_at
 * or created_at, asc/desc) are supported. All date fields in the result are
 * returned as ISO 8601 strings.
 *
 * @param props - Request properties
 * @param props.user - The authenticated user invoking this request
 * @param props.body - The filter, pagination, and search options for deleted
 *   todo logs
 * @returns Paginated set of deleted todo logs for the requesting user
 * @throws {Error} When the database query fails
 */
export async function patch__todoList_user_deletedTodoLogs(props: {
  user: UserPayload;
  body: import("../api/structures/ITodoListDeletedTodoLog").ITodoListDeletedTodoLog.IRequest;
}): Promise<
  import("../api/structures/IPageITodoListDeletedTodoLog").IPageITodoListDeletedTodoLog
> {
  const { user, body } = props;
  const page = body.page ?? 1;
  const limit = body.limit ?? 20;

  const where = {
    todo_list_user_id: user.id,
    ...(body.is_completed !== undefined &&
      body.is_completed !== null && { is_completed: body.is_completed }),
    ...((body.deleted_since !== undefined && body.deleted_since !== null) ||
    (body.deleted_before !== undefined && body.deleted_before !== null)
      ? {
          deleted_at: {
            ...(body.deleted_since !== undefined &&
              body.deleted_since !== null && { gte: body.deleted_since }),
            ...(body.deleted_before !== undefined &&
              body.deleted_before !== null && { lte: body.deleted_before }),
          },
        }
      : {}),
    ...(body.search !== undefined &&
      body.search !== null &&
      body.search !== "" && {
        title: {
          contains: body.search,
          mode: "insensitive" as const,
        },
      }),
  };

  const [rows, total] = await Promise.all([
    MyGlobal.prisma.todo_list_deleted_todo_logs.findMany({
      where,
      orderBy: [
        {
          [body.sort_by ?? "deleted_at"]:
            body.sort_direction === "asc" ? "asc" : "desc",
        },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    MyGlobal.prisma.todo_list_deleted_todo_logs.count({ where }),
  ]);

  return {
    pagination: {
      current: Number(page),
      limit: Number(limit),
      records: total,
      pages: Math.ceil(total / limit),
    },
    data: rows.map((row) => ({
      id: row.id,
      original_todo_id: row.original_todo_id,
      title: row.title,
      description: row.description ?? undefined,
      due_date:
        row.due_date !== undefined && row.due_date !== null
          ? toISOStringSafe(row.due_date)
          : null,
      is_completed: row.is_completed,
      completed_at:
        row.completed_at !== undefined && row.completed_at !== null
          ? toISOStringSafe(row.completed_at)
          : null,
      created_at: toISOStringSafe(row.created_at),
      updated_at: toISOStringSafe(row.updated_at),
      deleted_at: toISOStringSafe(row.deleted_at),
    })),
  };
}
