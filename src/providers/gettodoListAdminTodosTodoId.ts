import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { HttpException } from "@nestjs/common";
import { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import { AdminPayload } from "../decorators/payload/AdminPayload";

/**
 * Retrieve details of a single todo by its unique identifier (todo_list_todos
 * table).
 *
 * Allows admin to fetch the complete detail of any user's todo item using the
 * todoId. Results include all business fields: ownership, content, status, due
 * date, created/updated/completed timestamps. If the todo does not exist, a 404
 * Not Found error is thrown. Only the admin role may access this endpoint.
 *
 * @param props - The parameter object
 * @param props.admin - The authenticated admin making this request
 * @param props.todoId - The todo item's UUID
 * @returns The complete todo item details (ITodoListTodo)
 * @throws {Error} 404 if not found
 */
export async function gettodoListAdminTodosTodoId(props: {
  admin: AdminPayload;
  todoId: string & tags.Format<"uuid">;
}): Promise<ITodoListTodo> {
  const { todoId } = props;

  const todo = await MyGlobal.prisma.todo_list_todos.findUnique({
    where: { id: todoId },
  });

  if (!todo) {
    throw new HttpException("Todo not found", 404);
  }

  return {
    id: todo.id,
    todo_list_user_id: todo.todo_list_user_id,
    content: todo.content,
    due_date: todo.due_date != null ? toISOStringSafe(todo.due_date) : null,
    completed: todo.completed,
    completed_at:
      todo.completed_at != null ? toISOStringSafe(todo.completed_at) : null,
    created_at: toISOStringSafe(todo.created_at),
    updated_at: toISOStringSafe(todo.updated_at),
  };
}
