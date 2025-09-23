import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { HttpException } from "@nestjs/common";
import { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import { IPageITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListTodo";
import { UserPayload } from "../decorators/payload/UserPayload";

/**
 * Search and retrieve a filtered, paginated list of todos for a user
 * (todo_list_todos table).
 *
 * This endpoint returns a user's todos filtered by content, completion status,
 * due date and paginated. Only the user's own todos are visible. Excludes
 * soft-deleted users. Throws 400 for negative page/limit.
 *
 * @param props - Contains authenticated user and filter/pagination body.
 * @param props.user - Authenticated user (role: user)
 * @param props.body - Search, filter, and pagination parameters
 * @returns Paginated result set of todo task summaries matching filters
 * @throws {HttpException} 400 for bad pagination, 403 unauthorized, 404 if user
 *   is deleted/inactive
 */
export async function patchtodoListUserTodos(props: {
  user: UserPayload;
  body: ITodoListTodo.IRequest;
}): Promise<IPageITodoListTodo.ISummary> {
  const { user, body } = props;

  // Defensive pagination: default page/limit (must be >=1/0)
  const limit = body.limit ?? 20;
  const page = body.page ?? 1;
  if (limit <= 0 || page < 1) {
    throw new HttpException("Bad Request: Page must be >= 1, limit > 0", 400);
  }

  // Confirm user exists, not deleted, status active
  const userRecord = await MyGlobal.prisma.todo_list_users.findFirst({
    where: {
      id: user.id,
      deleted_at: null,
      status: "active",
    },
    select: { id: true },
  });
  if (!userRecord) {
    throw new HttpException("User not found or inactive", 404);
  }

  // Build where clause for todos
  const todoWhere: Record<string, unknown> = {
    todo_list_user_id: user.id,
  };
  if (body.search && body.search.trim().length > 0) {
    todoWhere.content = { contains: body.search.trim() };
  }
  if (body.completed !== undefined) {
    todoWhere.completed = body.completed;
  }
  if (body.due_date !== undefined) {
    todoWhere.due_date = body.due_date;
  }

  // Query todos and count in parallel
  const [todos, total] = await Promise.all([
    MyGlobal.prisma.todo_list_todos.findMany({
      where: todoWhere,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    MyGlobal.prisma.todo_list_todos.count({ where: todoWhere }),
  ]);

  // Map to ISummary format
  const data = todos.map((t) => ({
    id: t.id,
    content: t.content,
    due_date: t.due_date ? toISOStringSafe(t.due_date) : null,
    completed: t.completed,
    completed_at: t.completed_at ? toISOStringSafe(t.completed_at) : null,
    created_at: toISOStringSafe(t.created_at),
  }));

  return {
    pagination: {
      current: Number(page),
      limit: Number(limit),
      records: total,
      pages: Math.ceil(total / Number(limit)),
    },
    data,
  };
}
