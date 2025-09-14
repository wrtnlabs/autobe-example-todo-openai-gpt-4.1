import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListTodos } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodos";
import { IPageITodoListTodos } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListTodos";
import { UserPayload } from "../decorators/payload/UserPayload";

/**
 * Search, filter, and paginate todo items for the authenticated user.
 *
 * This endpoint enables registered users to retrieve a paginated, filtered list
 * of their own todo items from the todo_list_todos table. It supports optional
 * filtering by completion status, due date, and keyword search in the
 * title/description. Sorting and pagination options are configurable via the
 * payload. Only the user's own records are visible; admin privilege is not
 * supported in this endpoint. All returned fields strictly match the ISummary
 * DTO and respect schema constraints.
 *
 * @param props - Operation argument
 * @param props.user - Authenticated user performing the query
 * @param props.body - Listing, filter, search, sort, and pagination parameters
 * @returns Paginated summary list of user's own todos matching the criteria
 * @throws {Error} If query fails or database unavailable
 */
export async function patch__todoList_user_todos(props: {
  user: UserPayload;
  body: ITodoListTodos.IRequest;
}): Promise<IPageITodoListTodos.ISummary> {
  const { user, body } = props;
  const {
    is_completed,
    due_date_from,
    due_date_to,
    search,
    sort_by,
    sort_order,
    page,
    limit,
  } = body;

  // -- Pagination
  const effectiveLimit = Math.max(
    1,
    Math.min(typeof limit === "number" ? limit : 20, 100),
  );
  const effectivePage = Math.max(1, typeof page === "number" ? page : 1);
  const skip = (effectivePage - 1) * effectiveLimit;

  // -- Sorting
  const allowedSorts = ["created_at", "due_date", "is_completed"] as const;
  const orderField = allowedSorts.includes(sort_by || ("" as any))
    ? sort_by!
    : "created_at";
  const orderDir = sort_order === "asc" ? "asc" : "desc";

  // -- Filtering inline (NB: no intermediate variables for Prisma operations)
  const [rows, total] = await Promise.all([
    MyGlobal.prisma.todo_list_todos.findMany({
      where: {
        todo_list_user_id: user.id,
        ...(typeof is_completed === "boolean" && { is_completed }),
        ...((due_date_from || due_date_to) && {
          due_date: {
            ...(due_date_from ? { gte: due_date_from } : {}),
            ...(due_date_to ? { lte: due_date_to } : {}),
          },
        }),
        ...(search
          ? {
              OR: [
                { title: { contains: search } },
                { description: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: {
        [orderField]: orderDir,
      },
      skip,
      take: effectiveLimit,
      select: {
        id: true,
        title: true,
        is_completed: true,
        due_date: true,
        completed_at: true,
        created_at: true,
        updated_at: true,
      },
    }),
    MyGlobal.prisma.todo_list_todos.count({
      where: {
        todo_list_user_id: user.id,
        ...(typeof is_completed === "boolean" && { is_completed }),
        ...((due_date_from || due_date_to) && {
          due_date: {
            ...(due_date_from ? { gte: due_date_from } : {}),
            ...(due_date_to ? { lte: due_date_to } : {}),
          },
        }),
        ...(search
          ? {
              OR: [
                { title: { contains: search } },
                { description: { contains: search } },
              ],
            }
          : {}),
      },
    }),
  ]);

  // ISummary mapping with strict date formatting and correct optionality
  const data = rows.map((todo) => ({
    id: todo.id,
    title: todo.title,
    is_completed: todo.is_completed,
    due_date: todo.due_date ? toISOStringSafe(todo.due_date) : undefined,
    completed_at: todo.completed_at
      ? toISOStringSafe(todo.completed_at)
      : undefined,
    created_at: toISOStringSafe(todo.created_at),
    updated_at: toISOStringSafe(todo.updated_at),
  }));

  return {
    pagination: {
      current: Number(effectivePage),
      limit: Number(effectiveLimit),
      records: Number(total),
      pages: Number(Math.ceil(total / effectiveLimit)),
    },
    data,
  };
}
