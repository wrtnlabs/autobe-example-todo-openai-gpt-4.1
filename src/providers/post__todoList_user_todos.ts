import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListTodos } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodos";
import { UserPayload } from "../decorators/payload/UserPayload";

/**
 * Create a new todo item for the authenticated user in the todo_list_todos
 * table.
 *
 * This endpoint creates a todo item belonging to the currently authenticated
 * user identified via UserPayload. It requires a non-empty, max-255-character
 * title and supports optional description (max 2000 chars), optional due date
 * (must be today or future), and an is_completed flag which defaults to false
 * if omitted. Timestamps and ownership are assigned by the backend. Returns the
 * complete ITodoListTodos object for the created row.
 *
 * Security: Only authenticated users may use this endpoint; user identity is
 * enforced by payload and DB integrity.
 *
 * @param props - Function arguments
 * @param props.user - Authenticated user payload indicating todo_list_user
 *   ownership
 * @param props.body - Request body for ITodoListTodos.ICreate containing todo
 *   fields
 * @returns The fully populated todo item as ITodoListTodos, including all
 *   system-generated fields
 * @throws {Error} If database operation fails
 */
export async function post__todoList_user_todos(props: {
  user: UserPayload;
  body: ITodoListTodos.ICreate;
}): Promise<ITodoListTodos> {
  const { user, body } = props;
  const now: string & tags.Format<"date-time"> = toISOStringSafe(new Date());
  const id: string & tags.Format<"uuid"> = v4();
  const is_completed: boolean =
    body.is_completed === undefined ? false : body.is_completed;
  const completed_at: (string & tags.Format<"date-time">) | null = is_completed
    ? now
    : null;
  const created = await MyGlobal.prisma.todo_list_todos.create({
    data: {
      id,
      todo_list_user_id: user.id,
      title: body.title,
      description: body.description ?? null,
      due_date: body.due_date ?? null,
      is_completed,
      created_at: now,
      updated_at: now,
      completed_at,
    },
  });
  return {
    id: created.id,
    todo_list_user_id: created.todo_list_user_id,
    title: created.title,
    description: created.description ?? null,
    due_date: created.due_date ? toISOStringSafe(created.due_date) : null,
    is_completed: created.is_completed,
    created_at: toISOStringSafe(created.created_at),
    updated_at: toISOStringSafe(created.updated_at),
    completed_at: created.completed_at
      ? toISOStringSafe(created.completed_at)
      : null,
  };
}
