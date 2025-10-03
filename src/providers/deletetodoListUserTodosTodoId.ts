import { HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import typia, { tags } from "typia";
import { v4 } from "uuid";
import { MyGlobal } from "../MyGlobal";
import { PasswordUtil } from "../utils/PasswordUtil";
import { toISOStringSafe } from "../utils/toISOStringSafe";

import { UserPayload } from "../decorators/payload/UserPayload";

export async function deleteTodoListUserTodosTodoId(props: {
  user: UserPayload;
  todoId: string & tags.Format<"uuid">;
}): Promise<void> {
  const { user, todoId } = props;

  // Fetch the todo by ID (must exist)
  const todo = await MyGlobal.prisma.todo_list_todos.findUnique({
    where: { id: todoId },
    select: {
      id: true,
      todo_list_user_id: true,
    },
  });
  if (!todo) {
    throw new HttpException("Todo not found", 404);
  }
  // Only owner can delete (user.id must match todo_list_user_id)
  if (todo.todo_list_user_id !== user.id) {
    throw new HttpException(
      "Unauthorized: You can only delete your own todos",
      403,
    );
  }
  // Hard delete
  await MyGlobal.prisma.todo_list_todos.delete({ where: { id: todoId } });
}
