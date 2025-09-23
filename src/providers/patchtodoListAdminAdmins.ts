import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { HttpException } from "@nestjs/common";
import { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import { IPageITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListAdmin";
import { AdminPayload } from "../decorators/payload/AdminPayload";

/**
 * List/search all Todo List administrator accounts with filtering and
 * pagination.
 *
 * Only accessible to authenticated admins. Supports filter by email, name,
 * privilege level, status, date ranges, and search query (partial name/email
 * match). Paginates and sorts results. Excludes password hashes and
 * soft-deleted administrators.
 *
 * @param props - Object with authentication (admin) and filter/search
 *   pagination parameters
 * @param props.admin - Authenticated AdminPayload (authorization required)
 * @param props.body - Filter/sort/search/page settings (see
 *   ITodoListAdmin.IRequest)
 * @returns Paginated list of administrator account summaries (see
 *   IPageITodoListAdmin.ISummary)
 * @throws {HttpException} If not authorized or on database error
 */
export async function patchtodoListAdminAdmins(props: {
  admin: AdminPayload;
  body: ITodoListAdmin.IRequest;
}): Promise<IPageITodoListAdmin.ISummary> {
  const { body } = props;

  // Normalize & cap pagination
  const page = Math.max(1, body.page ?? 1);
  const limit = Math.min(100, Math.max(1, body.limit ?? 20));
  const skip = (page - 1) * limit;

  // Build where clause (soft delete always, plus filters)
  const where = {
    deleted_at: null,
    ...(body.email ? { email: { contains: body.email } } : {}),
    ...(body.name ? { name: { contains: body.name } } : {}),
    ...(body.privilege_level ? { privilege_level: body.privilege_level } : {}),
    ...(body.status ? { status: body.status } : {}),
    // Date bounds
    ...(body.created_from || body.created_to
      ? {
          created_at: {
            ...(body.created_from ? { gte: body.created_from } : {}),
            ...(body.created_to ? { lte: body.created_to } : {}),
          },
        }
      : {}),
    ...(body.last_login_from || body.last_login_to
      ? {
          last_login_at: {
            ...(body.last_login_from ? { gte: body.last_login_from } : {}),
            ...(body.last_login_to ? { lte: body.last_login_to } : {}),
          },
        }
      : {}),
    // Free-text search (name or email)
    ...(body.search
      ? {
          OR: [
            { name: { contains: body.search } },
            { email: { contains: body.search } },
          ],
        }
      : {}),
  };

  // Sorting
  const sortFields = [
    "email",
    "created_at",
    "last_login_at",
    "name",
    "status",
    "privilege_level",
  ];
  const sortBy =
    body.sort_by && sortFields.includes(body.sort_by)
      ? body.sort_by
      : "created_at";
  const direction: "asc" | "desc" = body.direction === "asc" ? "asc" : "desc";

  // Retrieve paginated admins and total
  const [admins, total] = await Promise.all([
    MyGlobal.prisma.todo_list_admins.findMany({
      where,
      orderBy: { [sortBy]: direction },
      skip,
      take: limit,
    }),
    MyGlobal.prisma.todo_list_admins.count({ where }),
  ]);

  const data = admins.map((a) => {
    return {
      id: a.id,
      email: a.email,
      name: a.name ?? null,
      avatar_uri: a.avatar_uri ?? null,
      status: a.status,
      privilege_level: a.privilege_level,
      last_admin_action_at: a.last_admin_action_at
        ? toISOStringSafe(a.last_admin_action_at)
        : null,
      last_login_at: a.last_login_at ? toISOStringSafe(a.last_login_at) : null,
      created_at: toISOStringSafe(a.created_at),
    };
  });

  return {
    pagination: {
      current: page,
      limit: limit,
      records: total,
      pages: Math.ceil(total / limit),
    },
    data,
  };
}
