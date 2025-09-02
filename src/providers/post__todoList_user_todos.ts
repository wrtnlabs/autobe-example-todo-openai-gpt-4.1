import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import { UserPayload } from "../decorators/payload/UserPayload";

/**
 * Create a new todo for the user in todo_list_todos.
 *
 * Allows an authenticated user to create a new todo item. Requires mandatory
 * title (1–255 characters, unique among incomplete todos per user), with
 * optional description (up to 1000 characters) and due date (must be future
 * date if provided). Acts on todo_list_todos table, associating the item to the
 * authenticated owner. The created todo is returned with all relevant business
 * fields.
 *
 * - Enforces ownership via authenticated user.
 * - Business validation (title constraints, description <1000 chars, due_date
 *   future, etc) expected to be handled by upstream validation or DB
 *   constraints.
 * - Uniqueness violation (duplicate incomplete todo title) is handled by DB and
 *   propagates as exception.
 * - Sets completed_at only if is_completed=true at creation.
 * - Populates created_at and updated_at with current timestamp.
 *
 * @param props - Request properties
 * @param props.user - The authenticated user creating the todo
 * @param props.body - Todo creation data: title (required), description,
 *   due_date, optional is_completed
 * @returns Details of the created todo item including all fields from
 *   todo_list_todos.
 * @throws {Error} When constraint violations (e.g., duplicate, length) occur.
 */
export async function post__todoList_user_todos(props: {
  user: UserPayload;
  body: ITodoListTodo.ICreate;
}): Promise<ITodoListTodo> {
  const { user, body } = props;
  const now: string & tags.Format<"date-time"> = toISOStringSafe(new Date());
  const id: string & tags.Format<"uuid"> = v4();
  // Default is_completed to false if not provided.
  const is_completed: boolean = body.is_completed === true;
  // completed_at only set iff is_completed is true on creation
  const completed_at: (string & tags.Format<"date-time">) | null = is_completed
    ? now
    : null;

  const created = await MyGlobal.prisma.todo_list_todos.create({
    data: {
      id,
      todo_list_user_id: user.id,
      title: body.title,
      description: body.description ?? undefined,
      due_date: body.due_date ?? undefined,
      is_completed,
      completed_at,
      created_at: now,
      updated_at: now,
    },
  });

  // Convert all Date fields to ISO string (already stored as string in DB/Prisma)
  return {
    id: created.id,
    title: created.title,
    description: created.description ?? undefined,
    due_date: created.due_date ? toISOStringSafe(created.due_date) : null,
    is_completed: created.is_completed,
    completed_at: created.completed_at
      ? toISOStringSafe(created.completed_at)
      : null,
    created_at: toISOStringSafe(created.created_at),
    updated_at: toISOStringSafe(created.updated_at),
  };
}
