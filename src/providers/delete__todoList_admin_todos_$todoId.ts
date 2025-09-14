import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { AdminPayload } from "../decorators/payload/AdminPayload";

/**
 * Permanently deletes a todo item by unique identifier (admin only).
 *
 * Removes a todo item from the todo_list_todos table based on the specified
 * todoId (UUID). This is a hard delete—no soft delete logic is applied. Only
 * admins may invoke this operation. Throws an error if the todo does not exist.
 * No recovery or further access is allowed post-deletion.
 *
 * @param props - Request object
 * @param props.admin - The authenticated admin (must exist, role validated at
 *   decorator layer)
 * @param props.todoId - Unique identifier (UUID) of the todo to delete
 * @returns Void upon successful deletion
 * @throws {Error} If the todo does not exist
 */
export async function delete__todoList_admin_todos_$todoId(props: {
  admin: AdminPayload;
  todoId: string & tags.Format<"uuid">;
}): Promise<void> {
  const { todoId } = props;
  const existing = await MyGlobal.prisma.todo_list_todos.findUnique({
    where: { id: todoId },
  });
  if (!existing) {
    throw new Error("Todo not found");
  }
  await MyGlobal.prisma.todo_list_todos.delete({
    where: { id: todoId },
  });
}
