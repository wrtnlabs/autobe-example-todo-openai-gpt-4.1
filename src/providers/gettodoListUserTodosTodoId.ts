import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { HttpException } from "@nestjs/common";
import { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import { UserPayload } from "../decorators/payload/UserPayload";

/**
 * Retrieve details of a single todo by its unique identifier (todo_list_todos
 * table).
 *
 * This operation returns the complete field set for the specified todo item,
 * provided the authenticated user is the owner. If the todo does not exist, a
 * 404 error is thrown. If the user does not own the todo, a 403 forbidden error
 * is thrown.
 *
 * @param props - Request properties
 * @param props.user - The authenticated user requesting the todo
 * @param props.todoId - The UUID of the todo to retrieve
 * @returns The full todo details for the given todoId, if owned by the user
 * @throws {HttpException} When the todo is not found (404), or access is
 *   forbidden (403)
 */
export async function gettodoListUserTodosTodoId(props: {
  user: UserPayload;
  todoId: string & tags.Format<"uuid">;
}): Promise<ITodoListTodo> {
  const { user, todoId } = props;
  const todo = await MyGlobal.prisma.todo_list_todos.findUnique({
    where: { id: todoId },
  });

  if (todo === null) {
    throw new HttpException("Todo not found", 404);
  }
  if (todo.todo_list_user_id !== user.id) {
    throw new HttpException(
      "Forbidden: You do not have access to this todo",
      403,
    );
  }
  return {
    id: todo.id,
    todo_list_user_id: todo.todo_list_user_id,
    content: todo.content,
    due_date: todo.due_date ? toISOStringSafe(todo.due_date) : null,
    completed: todo.completed,
    completed_at: todo.completed_at ? toISOStringSafe(todo.completed_at) : null,
    created_at: toISOStringSafe(todo.created_at),
    updated_at: toISOStringSafe(todo.updated_at),
  };
}
