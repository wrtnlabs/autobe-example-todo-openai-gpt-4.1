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
 * Paginated, filtered list of the user's deleted todos within audit retention
 * window.
 *
 * Retrieves a paginated and filtered list of deleted todo items for the
 * authenticated user, sourced from the todo_list_deleted_todo_logs audit table.
 * Includes support for deletion date range filtering, full-text search on
 * title, completion-status filter, and customizable sorting/pagination.
 * Implements strict user ownership enforcement and does not permit leaking any
 * non-owned data.
 *
 * @param props Request properties
 * @param props.user The authenticated user making the request. Used for strict
 *   ownership scoping.
 * @param props.body Search, filter, and pagination criteria for retrieving
 *   deleted todos (see ITodoListDeletedTodoLog.IRequest)
 * @returns A paginated result of deleted todo logs matching the request
 *   criteria and user context.
 * @throws {Error} When invalid parameter values are supplied or internal errors
 *   occur during query execution.
 */
export async function patch__todoList_user_todos_deleted(props: {
  user: UserPayload;
  body: ITodoListDeletedTodoLog.IRequest;
}): Promise<IPageITodoListDeletedTodoLog> {
  const { user, body } = props;

  // Compute pagination boundaries
  const page = body.page && body.page >= 1 ? body.page : 1;
  const limit =
    body.limit && body.limit >= 1 && body.limit <= 100 ? body.limit : 20;
  const skip = (page - 1) * limit;

  // Safely normalize sort field and direction
  const sortField: "deleted_at" | "created_at" =
    body.sort_by === "created_at" ? "created_at" : "deleted_at";
  const sortDirection: "asc" | "desc" =
    body.sort_direction === "asc" ? "asc" : "desc";

  // Build where filter - only include if value is not undefined/null
  const where = {
    todo_list_user_id: user.id,
    ...(body.deleted_since !== undefined &&
      body.deleted_since !== null && {
        deleted_at: { gte: body.deleted_since },
      }),
    ...(body.deleted_before !== undefined &&
      body.deleted_before !== null && {
        deleted_at: {
          ...(body.deleted_since !== undefined &&
            body.deleted_since !== null && { gte: body.deleted_since }),
          lte: body.deleted_before,
        },
      }),
    ...(body.search !== undefined &&
      body.search !== null &&
      body.search.length > 0 && {
        title: { contains: body.search, mode: "insensitive" as const },
      }),
    ...(body.is_completed !== undefined &&
      body.is_completed !== null && {
        is_completed: body.is_completed,
      }),
  };

  // Query paginated results + total count concurrently
  const [rows, total] = await Promise.all([
    MyGlobal.prisma.todo_list_deleted_todo_logs.findMany({
      where,
      orderBy: { [sortField]: sortDirection },
      skip,
      take: limit,
    }),
    MyGlobal.prisma.todo_list_deleted_todo_logs.count({ where }),
  ]);

  // Map Prisma results to DTO, converting all Date objects to ISO strings
  const data = rows.map((row) => ({
    id: row.id,
    original_todo_id: row.original_todo_id,
    title: row.title,
    description: row.description ?? undefined,
    due_date: row.due_date ? toISOStringSafe(row.due_date) : undefined,
    is_completed: row.is_completed,
    completed_at: row.completed_at
      ? toISOStringSafe(row.completed_at)
      : undefined,
    created_at: toISOStringSafe(row.created_at),
    updated_at: toISOStringSafe(row.updated_at),
    deleted_at: toISOStringSafe(row.deleted_at),
  }));

  return {
    pagination: {
      current: Number(page),
      limit: Number(limit),
      records: total,
      pages: total === 0 ? 1 : Math.ceil(total / limit),
    },
    data,
  };
}
