import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import { UserPayload } from "../decorators/payload/UserPayload";

/**
 * Updates a user-owned todo item by its ID.
 *
 * Allows an authenticated user to modify a todo's title, description, due date,
 * and completion state. Enforces business rules: per-user uniqueness for
 * incomplete todo titles, field constraints on text and due dates, and
 * timestamp management. Only acts if the todo exists and is owned by the
 * caller. Will update both domain fields and audit timestamps. Throws not found
 * if the todo does not exist or is not owned. Duplicate title/incomplete
 * combination will throw an error due to DB constraint.
 *
 * @param props - Request properties
 * @param props.user - The authenticated user who must own the todo
 * @param props.todoId - The unique ID of the todo to update
 * @param props.body - The fields to update (title, description, due_date,
 *   is_completed)
 * @returns The updated todo entry as ITodoListTodo
 * @throws {Error} If not found or not owned by the user, or if
 *   uniqueness/constraint is violated
 */
export async function put__todoList_user_todos_$todoId(props: {
  user: UserPayload;
  todoId: string & tags.Format<"uuid">;
  body: ITodoListTodo.IUpdate;
}): Promise<ITodoListTodo> {
  const { user, todoId, body } = props;

  // Ownership enforcement + existence check
  const todo = await MyGlobal.prisma.todo_list_todos.findFirst({
    where: { id: todoId, todo_list_user_id: user.id },
  });
  if (!todo) throw new Error("Todo not found or not owned by user");

  // Compute completion timestamp logic
  const updated_at = toISOStringSafe(new Date());
  let completed_at: (string & tags.Format<"date-time">) | null | undefined;
  if (body.is_completed === true) {
    completed_at = toISOStringSafe(new Date());
  } else if (body.is_completed === false) {
    completed_at = null;
  } // else undefined: leave unchanged

  // Issue update
  const updated = await MyGlobal.prisma.todo_list_todos.update({
    where: { id: todoId },
    data: {
      title: body.title ?? undefined,
      description: body.description ?? undefined,
      due_date: body.due_date ?? undefined,
      is_completed: body.is_completed ?? undefined,
      completed_at, // updates value or leaves unchanged
      updated_at,
    },
  });

  return {
    id: updated.id,
    title: updated.title as string & tags.MinLength<1> & tags.MaxLength<255>,
    description: updated.description ?? undefined,
    due_date: updated.due_date ? toISOStringSafe(updated.due_date) : undefined,
    is_completed: updated.is_completed,
    completed_at: updated.completed_at
      ? toISOStringSafe(updated.completed_at)
      : undefined,
    created_at: toISOStringSafe(updated.created_at),
    updated_at: toISOStringSafe(updated.updated_at),
  };
}
