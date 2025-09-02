import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import { UserPayload } from "../decorators/payload/UserPayload";

/**
 * Retrieve a single todo's full detail for the authenticated user.
 *
 * This endpoint allows an authenticated user to retrieve detailed information
 * about a single todo item they own, by todoId. Validates user ownership for
 * privacy and security before exposing confidential data. Fetches all available
 * fields (title, description, completion status, due date, timestamps) from the
 * todo_list_todos table. Ensures precise business domain rules—item must exist
 * and belong to the requesting user, or a not-found/permission error is
 * returned.
 *
 * Strict authorization and permission checks mean that only the owner can view
 * this resource; queries for nonexistent or non-owned todoId result in a
 * not-found or permission-denied error. Implementation must not expose whether
 * a missing todoId ever existed if not owned by the current user.
 *
 * Response data is suitable for detailed todo views, edit forms, or item
 * inspection in client UIs.
 *
 * @param props - Request properties
 * @param props.user - The authenticated user making the request
 * @param props.todoId - Unique identifier of the todo item to retrieve. Must be
 *   a valid UUID string.
 * @returns Full todo details for the specified todoId, if owned by user
 * @throws {Error} When the todo does not exist or is not owned by the user.
 */
export async function get__todoList_user_todos_$todoId(props: {
  user: UserPayload;
  todoId: string & tags.Format<"uuid">;
}): Promise<ITodoListTodo> {
  const { user, todoId } = props;

  const todo = await MyGlobal.prisma.todo_list_todos.findFirst({
    where: {
      id: todoId,
      todo_list_user_id: user.id,
    },
  });

  if (!todo) {
    throw new Error("Todo not found or access denied");
  }

  return {
    id: todo.id,
    title: todo.title,
    description: todo.description ?? undefined,
    due_date: todo.due_date ? toISOStringSafe(todo.due_date) : null,
    is_completed: todo.is_completed,
    completed_at: todo.completed_at ? toISOStringSafe(todo.completed_at) : null,
    created_at: toISOStringSafe(todo.created_at),
    updated_at: toISOStringSafe(todo.updated_at),
  };
}
