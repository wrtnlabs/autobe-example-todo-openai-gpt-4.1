import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListDeletedTodoLog } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListDeletedTodoLog";
import { UserPayload } from "../decorators/payload/UserPayload";

/**
 * Get detailed info for a deleted todo log by its ID, scoped to the current
 * user.
 *
 * Retrieve a single deleted todo log by the specified deletedTodoLogId from the
 * todo_list_deleted_todo_logs model. The operation ensures that the returned
 * audit log entry belongs to the currently authenticated user and is within the
 * allowed retention window for deleted item records.
 *
 * The returned object contains all snapshot fields as of deletion, enabling
 * detailed user history reviews and facilitating audit transparency. An error
 * is returned if the resource is not found, access is denied, or the log has
 * been purged due to expiration (after the retention period). Use this
 * operation for viewing detailed deleted todo data, not for active todo
 * management.
 *
 * @param props - Request properties
 * @param props.user - The authenticated user making the request
 * @param props.deletedTodoLogId - The unique identifier of the deleted todo log
 *   to retrieve
 * @returns The audit snapshot for the deleted todo log, capturing all preserved
 *   fields at deletion
 * @throws {Error} When the deleted todo log is not found, does not belong to
 *   the user, or is outside the retention window
 */
export async function get__todoList_user_deletedTodoLogs_$deletedTodoLogId(props: {
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
    throw new Error("Resource not found");
  }
  return {
    id: log.id,
    original_todo_id: log.original_todo_id,
    title: log.title,
    description: log.description ?? undefined,
    due_date: log.due_date != null ? toISOStringSafe(log.due_date) : null,
    is_completed: log.is_completed,
    completed_at:
      log.completed_at != null ? toISOStringSafe(log.completed_at) : null,
    created_at: toISOStringSafe(log.created_at),
    updated_at: toISOStringSafe(log.updated_at),
    deleted_at: toISOStringSafe(log.deleted_at),
  };
}
