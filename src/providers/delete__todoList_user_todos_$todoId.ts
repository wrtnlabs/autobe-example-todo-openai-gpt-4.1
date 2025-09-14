import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { UserPayload } from "../decorators/payload/UserPayload";

/**
 * Permanently delete a todo item by identifier from the todo_list_todos table
 * (owner only).
 *
 * Removes a todo item irreversibly from the todo_list_todos table, based on the
 * specified todoId. Only the owning user (authenticated via UserPayload) may
 * perform this action; others are denied. This executes a hard delete (no
 * soft-delete field exists in the schema), ensuring the record and all
 * dependent data are removed. Attempts to delete a non-existent or non-owned
 * todo will throw an error with an appropriate message.
 *
 * @param props - Properties for authenticated user deletion of a todo
 * @param props.user - Authenticated user attempting deletion
 * @param props.todoId - Unique identifier of the todo to be deleted (UUID)
 * @returns Void
 * @throws {Error} If the todo does not exist or the user lacks delete
 *   permission
 */
export async function delete__todoList_user_todos_$todoId(props: {
  user: UserPayload;
  todoId: string & tags.Format<"uuid">;
}): Promise<void> {
  const { user, todoId } = props;

  const todo = await MyGlobal.prisma.todo_list_todos.findUnique({
    where: { id: todoId },
  });
  if (!todo) {
    throw new Error("Todo not found");
  }
  if (todo.todo_list_user_id !== user.id) {
    throw new Error("Permission denied: only the owner may delete this todo");
  }

  await MyGlobal.prisma.todo_list_todos.delete({
    where: { id: todoId },
  });
}
