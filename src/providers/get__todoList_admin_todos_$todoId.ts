import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListTodos } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodos";
import { AdminPayload } from "../decorators/payload/AdminPayload";

/**
 * Retrieve a single todo item by identifier (for owner or admin) from the
 * todo_list_todos table.
 *
 * This operation fetches one specific todo, identified by its unique todoId
 * (UUID primary key), including all business fields as defined in the prisma
 * schema (id, todo_list_user_id, title, description, due_date, is_completed,
 * created_at, updated_at, completed_at). Admins are always authorized to view
 * any todo. Throws if the todo item does not exist. Dates are returned as ISO
 * 8601 UTC strings, never as native Date objects.
 *
 * @param props - An object containing:
 *
 *   - Admin: The authenticated AdminPayload (authorization context)
 *   - TodoId: The UUID primary key identifying the todo item to fetch
 *
 * @returns The complete business data for the requested todo as ITodoListTodos
 * @throws {Error} If the todoId cannot be found
 */
export async function get__todoList_admin_todos_$todoId(props: {
  admin: AdminPayload;
  todoId: string & tags.Format<"uuid">;
}): Promise<ITodoListTodos> {
  const { todoId } = props;
  const todo = await MyGlobal.prisma.todo_list_todos.findUniqueOrThrow({
    where: { id: todoId },
  });
  return {
    id: todo.id,
    todo_list_user_id: todo.todo_list_user_id,
    title: todo.title,
    description: todo.description ?? undefined,
    due_date: todo.due_date ? toISOStringSafe(todo.due_date) : undefined,
    is_completed: todo.is_completed,
    created_at: toISOStringSafe(todo.created_at),
    updated_at: toISOStringSafe(todo.updated_at),
    completed_at: todo.completed_at
      ? toISOStringSafe(todo.completed_at)
      : undefined,
  };
}
