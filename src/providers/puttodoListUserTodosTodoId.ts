import { HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import typia, { tags } from "typia";
import { v4 } from "uuid";
import { MyGlobal } from "../MyGlobal";
import { PasswordUtil } from "../utils/PasswordUtil";
import { toISOStringSafe } from "../utils/toISOStringSafe";

import { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import { UserPayload } from "../decorators/payload/UserPayload";

export async function putTodoListUserTodosTodoId(props: {
  user: UserPayload;
  todoId: string & tags.Format<"uuid">;
  body: ITodoListTodo.IUpdate;
}): Promise<ITodoListTodo> {
  const { user, todoId, body } = props;

  // Fetch todo by ID
  const todo = await MyGlobal.prisma.todo_list_todos.findUnique({
    where: { id: todoId },
  });
  if (!todo) {
    throw new HttpException("Todo not found", 404);
  }

  // Ownership check (UserPayload is always type 'user')
  if (todo.todo_list_user_id !== user.id) {
    throw new HttpException("Forbidden", 403);
  }

  // Determine update fields
  const now = toISOStringSafe(new Date());

  // Only update fields provided in body
  const data: {
    title?: string;
    is_completed?: boolean;
    completed_at?: (string & tags.Format<"date-time">) | null;
    updated_at: string & tags.Format<"date-time">;
  } = {
    updated_at: now,
  };

  if (body.title !== undefined) {
    data.title = body.title;
  }
  if (body.is_completed !== undefined) {
    data.is_completed = body.is_completed;
    data.completed_at = body.is_completed ? now : null;
  }

  const updated = await MyGlobal.prisma.todo_list_todos.update({
    where: { id: todoId },
    data,
  });

  return {
    id: updated.id,
    todo_list_user_id: updated.todo_list_user_id,
    title: updated.title,
    is_completed: updated.is_completed,
    created_at: toISOStringSafe(updated.created_at),
    updated_at: toISOStringSafe(updated.updated_at),
    completed_at:
      updated.completed_at !== null && updated.completed_at !== undefined
        ? toISOStringSafe(updated.completed_at)
        : null,
    deleted_at:
      updated.deleted_at !== null && updated.deleted_at !== undefined
        ? toISOStringSafe(updated.deleted_at)
        : undefined,
  };
}
