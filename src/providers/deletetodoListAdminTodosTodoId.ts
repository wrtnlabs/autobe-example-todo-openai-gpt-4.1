import { HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import typia, { tags } from "typia";
import { v4 } from "uuid";
import { MyGlobal } from "../MyGlobal";
import { PasswordUtil } from "../utils/PasswordUtil";
import { toISOStringSafe } from "../utils/toISOStringSafe";

import { AdminPayload } from "../decorators/payload/AdminPayload";

export async function deleteTodoListAdminTodosTodoId(props: {
  admin: AdminPayload;
  todoId: string & tags.Format<"uuid">;
}): Promise<void> {
  // Ensure the todo exists before deleting
  await MyGlobal.prisma.todo_list_todos.findUniqueOrThrow({
    where: { id: props.todoId },
  });
  await MyGlobal.prisma.todo_list_todos.delete({
    where: { id: props.todoId },
  });
}
