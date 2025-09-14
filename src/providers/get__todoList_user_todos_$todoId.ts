import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListTodos } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodos";
import { UserPayload } from "../decorators/payload/UserPayload";

/**
 * Retrieve a single todo item by identifier (for owner only) from the
 * todo_list_todos table.
 *
 * This operation fetches the complete details of a specific todo item by its
 * unique `todoId`. Only the owner (the user whose ID matches the todo's
 * `todo_list_user_id`) is permitted to view the todo; access by non-owners is
 * explicitly forbidden. No admin-level access is handled in this provider. All
 * available business fields are returned as defined in the Prisma schema and
 * output DTO. Permission boundaries and rigorous field type conversion are
 * strictly enforced for privacy and consistency.
 *
 * @param props - Request properties
 * @param props.user - The authenticated user performing the operation
 *   (UserPayload)
 * @param props.todoId - The unique identifier (UUID) for the todo to retrieve
 * @returns The fully populated todo item if owned by the user
 * @throws {Error} If the todo does not exist or the user does not own it
 */
export async function get__todoList_user_todos_$todoId(props: {
  user: UserPayload;
  todoId: string & tags.Format<"uuid">;
}): Promise<ITodoListTodos> {
  const { user, todoId } = props;
  const todo = await MyGlobal.prisma.todo_list_todos.findUnique({
    where: { id: todoId },
    select: {
      id: true,
      todo_list_user_id: true,
      title: true,
      description: true,
      due_date: true,
      is_completed: true,
      created_at: true,
      updated_at: true,
      completed_at: true,
    },
  });
  if (!todo) {
    throw new Error("Todo not found");
  }
  if (todo.todo_list_user_id !== user.id) {
    throw new Error("Forbidden: You do not own this todo");
  }
  return {
    id: todo.id,
    todo_list_user_id: todo.todo_list_user_id,
    title: todo.title,
    description: todo.description !== undefined ? todo.description : null,
    due_date: todo.due_date ? toISOStringSafe(todo.due_date) : null,
    is_completed: todo.is_completed,
    created_at: toISOStringSafe(todo.created_at),
    updated_at: toISOStringSafe(todo.updated_at),
    completed_at: todo.completed_at ? toISOStringSafe(todo.completed_at) : null,
  };
}
