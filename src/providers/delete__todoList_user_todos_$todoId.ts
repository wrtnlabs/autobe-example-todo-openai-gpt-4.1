import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { UserPayload } from "../decorators/payload/UserPayload";

/**
 * Permanently remove a todo item by todoId from todo_list_todos (hard delete).
 *
 * This function allows an authenticated user to permanently delete one of their
 * own todo items. Before performing the destructive removal, it ensures the
 * todo exists and that it is strictly owned by the requesting user. No soft
 * delete is performed; the todo is hard deleted and removed from active lists
 * immediately.
 *
 * Attempts to delete a todo that does not exist or is not owned by the user
 * will result in a generic not-found error to prevent resource enumeration.
 *
 * @param props - Request properties
 * @param props.user - The authenticated user performing the delete
 * @param props.todoId - The UUID of the todo to delete
 * @returns Resolves to void on successful hard delete
 * @throws {Error} If the todo does not exist or does not belong to the user
 */
export async function delete__todoList_user_todos_$todoId(props: {
  user: UserPayload;
  todoId: string & tags.Format<"uuid">;
}): Promise<void> {
  const { user, todoId } = props;

  // 1. Ensure todo exists and is strictly owned by user
  const todo = await MyGlobal.prisma.todo_list_todos.findFirst({
    where: {
      id: todoId,
      todo_list_user_id: user.id,
    },
    select: { id: true },
  });
  if (!todo) {
    // Privacy: generic error (do not leak resource presence to non-owner)
    throw new Error("Not found");
  }

  // 2. Proceed with hard delete (permanently remove from data store)
  await MyGlobal.prisma.todo_list_todos.delete({
    where: { id: todoId },
  });
}
