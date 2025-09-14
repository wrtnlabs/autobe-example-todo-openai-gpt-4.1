import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListTodos } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodos";
import { AdminPayload } from "../decorators/payload/AdminPayload";

/**
 * Create a new todo item for the authenticated admin in the todo_list_todos
 * table.
 *
 * Allows an authenticated admin to create a new todo item, setting the owner as
 * themselves (admin.id is stored as owner). All creation rules are enforced
 * strictly per schema: required title, optional description and due_date,
 * is_completed defaults to false if unspecified, timestamps are set by the
 * system. Returns the full ITodoListTodos record, with dates as ISO string.
 *
 * @param props - Object with admin authentication and todo creation fields
 * @param props.admin - The authenticated AdminPayload principal
 * @param props.body - Fields for creating a new todo (title, optional
 *   description, due_date, optional is_completed)
 * @returns The created todo item, fully populated
 * @throws {Error} If database operation fails
 */
export async function post__todoList_admin_todos(props: {
  admin: AdminPayload;
  body: ITodoListTodos.ICreate;
}): Promise<ITodoListTodos> {
  const { admin, body } = props;
  const now = toISOStringSafe(new Date());
  // is_completed: defaults to false (per schema spec)
  const isCompleted: boolean = body.is_completed === true;
  const completedAt: (string & tags.Format<"date-time">) | null = isCompleted
    ? now
    : null;

  const created = await MyGlobal.prisma.todo_list_todos.create({
    data: {
      id: v4() as string & tags.Format<"uuid">,
      todo_list_user_id: admin.id,
      title: body.title,
      description: body.description ?? null,
      due_date: body.due_date ?? null,
      is_completed: isCompleted,
      created_at: now,
      updated_at: now,
      completed_at: completedAt,
    },
  });
  // Fix: Prisma returns Date | null for completed_at, must handle for API response
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
