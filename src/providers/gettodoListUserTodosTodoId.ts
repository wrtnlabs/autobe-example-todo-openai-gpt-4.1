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

export async function getTodoListUserTodosTodoId(props: {
  user: UserPayload;
  todoId: string & tags.Format<"uuid">;
}): Promise<ITodoListTodo> {
  const { user, todoId } = props;

  // Find the Todo item by PK, throw 404 if not found
  const todo = await MyGlobal.prisma.todo_list_todos.findUniqueOrThrow({
    where: { id: todoId },
  });

  // Only allow if user owns the Todo
  if (user.id !== todo.todo_list_user_id) {
    throw new HttpException(
      "Forbidden: You do not have access to this Todo",
      403,
    );
  }

  // Build output per ITodoListTodo. Omit optionals if null.
  return {
    id: todo.id,
    todo_list_user_id: todo.todo_list_user_id,
    title: todo.title,
    is_completed: todo.is_completed,
    created_at: toISOStringSafe(todo.created_at),
    updated_at: toISOStringSafe(todo.updated_at),
    ...(todo.completed_at !== null && {
      completed_at: toISOStringSafe(todo.completed_at),
    }),
    ...(todo.deleted_at !== null && {
      deleted_at: toISOStringSafe(todo.deleted_at),
    }),
  };
}
