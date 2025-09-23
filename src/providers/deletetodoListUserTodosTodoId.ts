import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { HttpException } from "@nestjs/common";
import { UserPayload } from "../decorators/payload/UserPayload";

/**
 * Permanently delete a specific todo item from the user's todo list.
 *
 * This operation hard deletes the todo from the system, irreversibly removing
 * all task data from persistent storage. Only the owner of the todo (the
 * authenticated user) may perform this action. If the todo does not exist or is
 * not owned by the user, the operation fails with an error. There is no
 * soft-delete. Admin deletion and audit logging are not handled in this
 * user-only context.
 *
 * @param props - Object containing the authenticated user payload and the
 *   todoId (UUID) to delete
 * @param props.user - The authenticated user requesting deletion
 * @param props.todoId - The UUID of the todo to delete
 * @returns Void
 * @throws {Error} 404 if todo not found, 403 if user does not own the todo
 */
export async function deletetodoListUserTodosTodoId(props: {
  user: UserPayload;
  todoId: string & tags.Format<"uuid">;
}): Promise<void> {
  const { user, todoId } = props;

  // Find the todo and verify existence and ownership
  const todo = await MyGlobal.prisma.todo_list_todos.findUnique({
    where: { id: todoId },
    select: { id: true, todo_list_user_id: true },
  });
  if (!todo) throw new HttpException("Not Found: Todo does not exist", 404);
  if (todo.todo_list_user_id !== user.id)
    throw new HttpException(
      "Forbidden: You may only delete your own todos",
      403,
    );

  // Hard delete (no soft-deletion)
  await MyGlobal.prisma.todo_list_todos.delete({
    where: { id: todoId },
  });
}
