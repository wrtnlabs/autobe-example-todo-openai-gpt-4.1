import { HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import typia, { tags } from "typia";
import { v4 } from "uuid";
import { MyGlobal } from "../MyGlobal";
import { PasswordUtil } from "../utils/PasswordUtil";
import { toISOStringSafe } from "../utils/toISOStringSafe";

import { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import { AdminPayload } from "../decorators/payload/AdminPayload";

export async function getTodoListAdminTodosTodoId(props: {
  admin: AdminPayload;
  todoId: string & tags.Format<"uuid">;
}): Promise<ITodoListTodo> {
  // Admin is authorized to access any todo-list-todos record
  const todo = await MyGlobal.prisma.todo_list_todos.findUniqueOrThrow({
    where: { id: props.todoId },
    select: {
      id: true,
      todo_list_user_id: true,
      title: true,
      is_completed: true,
      created_at: true,
      updated_at: true,
      completed_at: true,
      deleted_at: true,
    },
  });
  return {
    id: todo.id,
    todo_list_user_id: todo.todo_list_user_id,
    title: todo.title,
    is_completed: todo.is_completed,
    created_at: toISOStringSafe(todo.created_at),
    updated_at: toISOStringSafe(todo.updated_at),
    completed_at: todo.completed_at ? toISOStringSafe(todo.completed_at) : null,
    deleted_at: todo.deleted_at ? toISOStringSafe(todo.deleted_at) : null,
  };
}
