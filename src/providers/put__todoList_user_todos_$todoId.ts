import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListTodos } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodos";
import { UserPayload } from "../decorators/payload/UserPayload";

/**
 * Update a todo item by identifier (allowed to owner) from the todo_list_todos
 * table.
 *
 * This operation updates the title, description, due date, or completion status
 * of an existing todo item. Only the owner of the todo (identified by
 * todo_list_user_id) is permitted to perform the update; requests by non-owners
 * are rejected. Business logic ensures mutual consistency: when the completion
 * status is set to true, the completed_at timestamp is marked with the current
 * time; if set to false, completed_at is cleared to null; otherwise,
 * completed_at is unchanged. All updates update the last modification timestamp
 * (updated_at). All fields are managed as ISO 8601 UTC-compliant strings
 * according to contract.
 *
 * Authorization: Only the todo's owner (the authenticated user) can update. No
 * admin or cross-user updates permitted.
 *
 * @param props - Props for update operation:
 *
 *   - User: Authenticated user payload (owner)
 *   - TodoId: UUID of the todo to update
 *   - Body: Partial ITodoListTodos.IUpdate fields (title, description, due_date,
 *       is_completed)
 *
 * @returns The updated todo item (all fields per ITodoListTodos, with dates as
 *   ISO 8601 string)
 * @throws {Error} If todo does not exist or user is not owner
 */
export async function put__todoList_user_todos_$todoId(props: {
  user: UserPayload;
  todoId: string & tags.Format<"uuid">;
  body: ITodoListTodos.IUpdate;
}): Promise<ITodoListTodos> {
  const { user, todoId, body } = props;
  // Fetch todo and verify ownership
  const todo = await MyGlobal.prisma.todo_list_todos.findUnique({
    where: { id: todoId },
  });
  if (!todo) throw new Error("Todo not found");
  if (todo.todo_list_user_id !== user.id) throw new Error("Permission denied");

  // Compute updated fields
  const now = toISOStringSafe(new Date());
  let completedAt: (string & tags.Format<"date-time">) | null | undefined =
    undefined;
  if (body.is_completed !== undefined) {
    completedAt = body.is_completed ? now : null;
  }
  const updated = await MyGlobal.prisma.todo_list_todos.update({
    where: { id: todoId },
    data: {
      title: body.title ?? undefined,
      description: body.description ?? undefined,
      due_date: body.due_date ?? undefined,
      is_completed: body.is_completed ?? undefined,
      completed_at: completedAt,
      updated_at: now,
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
