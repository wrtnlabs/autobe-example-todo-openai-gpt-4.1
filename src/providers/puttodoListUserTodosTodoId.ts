import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { HttpException } from "@nestjs/common";
import { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import { UserPayload } from "../decorators/payload/UserPayload";

/**
 * Update a todo item by its unique identifier (todo_list_todos table).
 *
 * This operation updates an existing todo item belonging to the authenticated
 * user. Only the owner may update their own todos. Validates business rules:
 * content (1-255, no all-whitespace, no control chars), due_date (cannot be in
 * the past or before creation), and handles completed status updates. Always
 * updates the last modification timestamp.
 *
 * @param props - Object containing user payload, todoId to update, and body
 *   with optional update fields.
 * @param props.user - The authenticated user performing the update (must be
 *   owner).
 * @param props.todoId - The unique id of the todo to update.
 * @param props.body - Update input fields: content, due_date, completed.
 * @returns The updated todo object with all editable fields and timestamps.
 * @throws {HttpException} When todo does not exist, user not owner, or business
 *   validation fails.
 */
export async function puttodoListUserTodosTodoId(props: {
  user: UserPayload;
  todoId: string & tags.Format<"uuid">;
  body: ITodoListTodo.IUpdate;
}): Promise<ITodoListTodo> {
  const { user, todoId, body } = props;
  const todo = await MyGlobal.prisma.todo_list_todos.findUnique({
    where: {
      id: todoId,
    },
  });
  if (!todo || todo.todo_list_user_id !== user.id) {
    throw new HttpException("Todo not found or access denied", 404);
  }
  // Validate content
  let updateContent: string | undefined;
  if (body.content !== undefined) {
    const trimmed = body.content.trim();
    if (trimmed.length < 1 || trimmed.length > 255) {
      throw new HttpException("Content must be 1~255 characters", 400);
    }
    if (/\p{C}/u.test(trimmed)) {
      throw new HttpException("Content cannot contain control characters", 400);
    }
    updateContent = trimmed;
  }
  // Validate due_date
  let updateDueDate: (string & tags.Format<"date-time">) | null | undefined =
    undefined;
  if (body.due_date !== undefined) {
    if (body.due_date === null) {
      updateDueDate = null;
    } else {
      // Acceptable formats: 'YYYY-MM-DD' or ISO8601
      const dueIso =
        body.due_date.length === 10
          ? `${body.due_date}T00:00:00.000Z`
          : body.due_date;
      const due = new Date(dueIso);
      const createdAt = new Date(todo.created_at);
      const now = new Date();
      if (isNaN(due.getTime())) {
        throw new HttpException("Invalid due_date format", 400);
      }
      if (due < createdAt) {
        throw new HttpException("Due date cannot be before todo creation", 400);
      }
      if (due < now) {
        throw new HttpException("Due date cannot be in the past", 400);
      }
      updateDueDate = toISOStringSafe(due);
    }
  }
  // Completed/completed_at logic
  let updateCompleted: boolean | undefined;
  let updateCompletedAt:
    | (string & tags.Format<"date-time">)
    | null
    | undefined = undefined;
  const reqCompleted = body.completed;
  const oldCompleted = todo.completed;
  if (reqCompleted !== undefined) {
    updateCompleted = reqCompleted;
    if (reqCompleted && !oldCompleted) {
      updateCompletedAt = toISOStringSafe(new Date());
    } else if (!reqCompleted) {
      updateCompletedAt = null;
    }
  }
  // Always update updated_at
  const updateInput = {
    ...(updateContent !== undefined && { content: updateContent }),
    ...(updateDueDate !== undefined && { due_date: updateDueDate }),
    ...(updateCompleted !== undefined && { completed: updateCompleted }),
    ...(reqCompleted !== undefined && { completed_at: updateCompletedAt }),
    updated_at: toISOStringSafe(new Date()),
  };
  const updated = await MyGlobal.prisma.todo_list_todos.update({
    where: { id: todoId },
    data: updateInput,
  });
  return {
    id: updated.id,
    todo_list_user_id: updated.todo_list_user_id,
    content: updated.content,
    due_date: updated.due_date ? toISOStringSafe(updated.due_date) : null,
    completed: updated.completed,
    completed_at: updated.completed_at
      ? toISOStringSafe(updated.completed_at)
      : null,
    created_at: toISOStringSafe(updated.created_at),
    updated_at: toISOStringSafe(updated.updated_at),
  };
}
