import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListDeletedTodoLog } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListDeletedTodoLog";
import { UserPayload } from "../decorators/payload/UserPayload";

/**
 * Retrieve a single deleted todo record by ID for the authenticated user.
 *
 * Fetches a detailed historical snapshot of a deleted todo log entry owned by
 * the authenticated user, sourced from the todo_list_deleted_todo_logs audit
 * table. Returns all business fields preserved at the time of deletion (title,
 * description, status, timestamps, etc.) for user audit purposes.
 *
 * Ownership and access are strictly enforced: only the owner (by user.id) may
 * access this resource. If not found, outside retention, or not owned, throws
 * an error with no information leakage.
 *
 * @param props - Request properties
 * @param props.user - The authenticated user (ownership enforced)
 * @param props.deletedTodoLogId - The UUID of the deleted todo log to fetch
 * @returns The deleted todo log snapshot as ITodoListDeletedTodoLog
 * @throws {Error} If the deleted log does not exist, is not owned, or is
 *   inaccessible
 */
export async function get__todoList_user_todos_deleted_$deletedTodoLogId(props: {
  user: UserPayload;
  deletedTodoLogId: string & tags.Format<"uuid">;
}): Promise<ITodoListDeletedTodoLog> {
  const { user, deletedTodoLogId } = props;
  const log = await MyGlobal.prisma.todo_list_deleted_todo_logs.findFirst({
    where: {
      id: deletedTodoLogId,
      todo_list_user_id: user.id,
    },
  });
  if (!log) {
    throw new Error("Deleted todo log not found or access denied");
  }
  return {
    id: log.id,
    original_todo_id: log.original_todo_id,
    title: log.title,
    description: log.description ?? undefined,
    due_date: log.due_date ? toISOStringSafe(log.due_date) : null,
    is_completed: log.is_completed,
    completed_at: log.completed_at ? toISOStringSafe(log.completed_at) : null,
    created_at: toISOStringSafe(log.created_at),
    updated_at: toISOStringSafe(log.updated_at),
    deleted_at: toISOStringSafe(log.deleted_at),
  };
}
