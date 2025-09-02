import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import { IPageITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListTodo";
import { IPage } from "@ORGANIZATION/PROJECT-api/lib/structures/IPage";
import { UserPayload } from "../decorators/payload/UserPayload";

/**
 * Paginated, searchable list of the authenticated user's todos from
 * todo_list_todos.
 *
 * Retrieve a paginated and filtered list of todo items for the authenticated
 * user. This operation queries the todo_list_todos table, strictly limiting
 * results to the caller's own records in compliance with the application's
 * ownership enforcement policies. Multiple search capabilities are
 * available—sort by due date or creation time, filter by completion status
 * (complete, incomplete, all), and search titles via case-insensitive substring
 * matching.
 *
 * Pagination parameters control page size and number, with defaults and limits
 * aligning with business rules (e.g., 20 items per page, up to 100 per page,
 * reasonable maximums applied). If the authenticated user requests a page
 * beyond available results, an empty result set with bounds information is
 * returned. No data from any other user is ever included.
 *
 * Security is paramount: authorization checks ensure only logged-in users can
 * access this endpoint, and all queries are scope-restricted to the user's own
 * todos by user ID. The response contains todo item summaries suitable for list
 * display, with sufficient detail for client navigation and further item
 * interaction.
 *
 * @param props - Request with UserPayload (user) and ITodoListTodo.IRequest
 *   (body)
 * @param props.user - Authenticated user requesting their own todos
 * @param props.body - Filtering, pagination, sorting, and search parameters
 * @returns Paginated list of user's todo item summaries matching query
 *   criteria.
 * @throws {Error} If user is not authorized or not found, or invalid parameters
 *   are provided
 */
export async function patch__todoList_user_todos(props: {
  user: UserPayload;
  body: ITodoListTodo.IRequest;
}): Promise<IPageITodoListTodo.ISummary> {
  const { user, body } = props;

  // Handle defaults and enforce limits per business rules
  let page = body.page ?? 1;
  let limit = body.limit ?? 20;
  if (page < 1) page = 1;
  if (limit < 1) limit = 20;
  if (limit > 100) limit = 100;

  // Build Prisma where clause
  const where = {
    todo_list_user_id: user.id,
    ...(body.status === "complete"
      ? { is_completed: true }
      : body.status === "incomplete"
        ? { is_completed: false }
        : {}),
    ...(typeof body.search === "string" && body.search.length > 0
      ? {
          title: {
            contains: body.search,
            mode: "insensitive" as const,
          },
        }
      : {}),
    ...((body.due_date_after !== undefined && body.due_date_after !== null) ||
    (body.due_date_before !== undefined && body.due_date_before !== null)
      ? {
          due_date: {
            ...(body.due_date_after !== undefined &&
            body.due_date_after !== null
              ? { gte: body.due_date_after }
              : {}),
            ...(body.due_date_before !== undefined &&
            body.due_date_before !== null
              ? { lte: body.due_date_before }
              : {}),
          },
        }
      : {}),
  };

  // Choose field to sort by, defaulting per spec
  const sortBy = body.sort_by === "due_date" ? "due_date" : "created_at";
  const sortDirection = body.sort_direction === "asc" ? "asc" : "desc";

  // Inline orderBy per core rule
  const orderBy = {
    [sortBy]: sortDirection,
  };

  // Pagination skip (page 1-based)
  const skip = (page - 1) * limit;

  // Parallel fetch of data and count
  const [rows, total] = await Promise.all([
    MyGlobal.prisma.todo_list_todos.findMany({
      where,
      orderBy,
      skip,
      take: limit,
    }),
    MyGlobal.prisma.todo_list_todos.count({ where }),
  ]);

  // Map Prisma data to summary DTO with date conversions
  const data = rows.map((row) => {
    return {
      id: row.id,
      title: row.title,
      is_completed: row.is_completed,
      due_date:
        row.due_date !== null && row.due_date !== undefined
          ? toISOStringSafe(row.due_date)
          : null,
      created_at: toISOStringSafe(row.created_at),
      updated_at: toISOStringSafe(row.updated_at),
    };
  });

  // Pagination computation, enforce at least 1 total page
  const pages = total > 0 ? Math.ceil(total / limit) : 1;
  const pagination: IPage.IPagination = {
    current: Number(page),
    limit: Number(limit),
    records: Number(total),
    pages: Number(pages),
  };

  return {
    pagination,
    data,
  };
}
