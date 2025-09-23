import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { HttpException } from "@nestjs/common";
import { AdminPayload } from "../decorators/payload/AdminPayload";

/**
 * Permanently delete a specific todo item from the user's todo list
 * (todo_list_todos table).
 *
 * Hard-deletes the todo identified by todoId. Operation is allowed only for
 * admin role (admin:AdminPayload required). Ensures that the todo exists; if
 * not, throws 404. After deletion, creates an audit log entry
 * (todo_list_audit_logs) logging action by admin. No soft-delete is performed;
 * the record is fully removed.
 *
 * @param props - Admin: Authenticated admin payload (must be active) todoId:
 *   The UUID of the todo to delete
 * @returns Void on success
 * @throws {HttpException} 404 if todo not found, 403 if authorization fails
 */
export async function deletetodoListAdminTodosTodoId(props: {
  admin: AdminPayload;
  todoId: string & tags.Format<"uuid">;
}): Promise<void> {
  const { admin, todoId } = props;

  // Find todo: throw 404 if missing
  const todo = await MyGlobal.prisma.todo_list_todos.findUnique({
    where: { id: todoId },
    select: { id: true, todo_list_user_id: true },
  });
  if (!todo) {
    throw new HttpException("Todo not found", 404);
  }

  // Perform hard delete
  await MyGlobal.prisma.todo_list_todos.delete({
    where: { id: todoId },
  });

  // Create audit log
  await MyGlobal.prisma.todo_list_audit_logs.create({
    data: {
      id: v4() as string & tags.Format<"uuid">,
      todo_list_admin_id: admin.id,
      todo_list_user_id: todo.todo_list_user_id,
      todo_list_todo_id: todoId,
      action: "delete",
      rationale: null,
      created_at: toISOStringSafe(new Date()),
    },
  });
}
