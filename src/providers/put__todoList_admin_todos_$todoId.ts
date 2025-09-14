import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListTodos } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodos";
import { AdminPayload } from "../decorators/payload/AdminPayload";

/**
 * Updates a specific todo item (by todoId/UUID) with new values for title,
 * description, due_date, or is_completed. Enforces all business logic,
 * including schema-level field validation and admin privilege. On update, sets
 * updated_at to current timestamp and completed_at according to completion
 * status. Returns the full updated todo item.
 *
 * @param props - Request object containing:
 *
 *   - Admin: The authenticated admin user (privileged role; authorization already
 *       established)
 *   - TodoId: The unique id of the todo item to update (UUID)
 *   - Body: ITodoListTodos.IUpdate containing fields to update
 *
 * @returns The updated ITodoListTodos record reflecting all changes
 * @throws {Error} If the todo does not exist
 */
export async function put__todoList_admin_todos_$todoId(props: {
  admin: AdminPayload;
  todoId: string & tags.Format<"uuid">;
  body: ITodoListTodos.IUpdate;
}): Promise<ITodoListTodos> {
  const { todoId, body } = props;
  const todo = await MyGlobal.prisma.todo_list_todos.findUnique({
    where: { id: todoId },
  });
  if (!todo) throw new Error("Todo not found");
  const now: string & tags.Format<"date-time"> = toISOStringSafe(new Date());
  let completed_at: (string & tags.Format<"date-time">) | null | undefined =
    todo.completed_at ? toISOStringSafe(todo.completed_at) : null;

  // Determine if completed_at needs to change:
  if (body.is_completed === true && todo.is_completed === false) {
    completed_at = now;
  } else if (body.is_completed === false && todo.is_completed === true) {
    completed_at = null;
  }

  const updated = await MyGlobal.prisma.todo_list_todos.update({
    where: { id: todoId },
    data: {
      title: body.title ?? undefined,
      description: body.description ?? undefined,
      due_date: body.due_date ?? undefined,
      is_completed: body.is_completed ?? undefined,
      updated_at: now,
      ...(body.is_completed !== undefined ? { completed_at } : {}),
    },
  });
  return {
    id: updated.id,
    todo_list_user_id: updated.todo_list_user_id,
    title: updated.title,
    description: updated.description ?? null,
    due_date: updated.due_date ? toISOStringSafe(updated.due_date) : null,
    is_completed: updated.is_completed,
    created_at: toISOStringSafe(updated.created_at),
    updated_at: toISOStringSafe(updated.updated_at),
    completed_at: updated.completed_at
      ? toISOStringSafe(updated.completed_at)
      : null,
  };
}
