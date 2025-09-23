import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { HttpException } from "@nestjs/common";
import { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import { IPageITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListTodo";
import { AdminPayload } from "../decorators/payload/AdminPayload";

/**
 * Search and retrieve a filtered, paginated list of all users' todos (admin).
 *
 * Supports filtering by content (partial match), completed status, due_date,
 * and paginates results. Only includes todos owned by users (todo_list_users)
 * that are NOT soft-deleted. Results sorted by 'sort' param or defaults to most
 * recent (created_at desc). Enforces functional, immutable data structure. Does
 * NOT use native Date or 'as'.
 *
 * @param props - Contains authenticated admin and optional filter/search params
 *   per ITodoListTodo.IRequest
 * @returns Paginated todo list summaries with full type branding
 * @throws {HttpException} If called without authenticated admin (enforced by
 *   decorator)
 */
export async function patchtodoListAdminTodos(props: {
  admin: AdminPayload;
  body: ITodoListTodo.IRequest;
}): Promise<IPageITodoListTodo.ISummary> {
  const { body } = props;
  // Defensive: default pagination
  const page = body.page && body.page > 0 ? body.page : 1;
  const limit = body.limit && body.limit > 0 ? body.limit : 20;
  if (page <= 0 || limit <= 0) {
    return {
      pagination: {
        current: 0,
        limit: 0,
        records: 0,
        pages: 0,
      },
      data: [],
    };
  }
  // Build search/filters
  const where: Record<string, unknown> = {
    user: { deleted_at: null },
    ...(body.search !== undefined &&
      body.search.trim().length > 0 && {
        content: { contains: body.search.trim() },
      }),
    ...(body.completed !== undefined && { completed: body.completed }),
    ...(body.due_date !== undefined && { due_date: body.due_date }),
  };
  // Sorting
  let orderBy: Record<string, "asc" | "desc">;
  if (body.sort !== undefined && /^\w+:(asc|desc)$/i.test(body.sort.trim())) {
    const [field, direction] = body.sort.trim().split(":");
    // Only allow known/safe sortable fields
    if (field === "created_at" || field === "due_date") {
      orderBy = { [field]: direction.toLowerCase() === "asc" ? "asc" : "desc" };
    } else {
      orderBy = { created_at: "desc" };
    }
  } else {
    orderBy = { created_at: "desc" };
  }
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    MyGlobal.prisma.todo_list_todos.findMany({
      where,
      orderBy,
      skip,
      take: limit,
    }),
    MyGlobal.prisma.todo_list_todos.count({ where }),
  ]);
  const data = rows.map((row) => {
    const summary: ITodoListTodo.ISummary = {
      id: row.id,
      content: row.content,
      due_date:
        row.due_date === null || row.due_date === undefined
          ? undefined
          : toISOStringSafe(row.due_date),
      completed: row.completed,
      completed_at:
        row.completed_at === null || row.completed_at === undefined
          ? undefined
          : toISOStringSafe(row.completed_at),
      created_at: toISOStringSafe(row.created_at),
    };
    return summary;
  });
  return {
    pagination: {
      current: Number(page),
      limit: Number(limit),
      records: Number(total),
      pages: Number(limit) > 0 ? Math.ceil(Number(total) / Number(limit)) : 0,
    },
    data,
  };
}
