import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { HttpException } from "@nestjs/common";
import { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import { IPageITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListUser";
import { AdminPayload } from "../decorators/payload/AdminPayload";

/**
 * Advanced search and pagination of all user accounts for administrators.
 *
 * Allows privileged admins to filter, search, sort, and page through user
 * accounts in the todo_list_users table. Supports extensive filtering (email,
 * name, status, registration dates, last login), free-text search, and
 * default/explicit pagination and sort order. Only non-deleted users
 * (deleted_at == null) are returned. Sensitive credential info is never
 * exposed.
 *
 * @param props - Properties for the search
 * @param props.admin - The authenticated administrator performing the request
 * @param props.body - Filter/search/sort/page parameters
 *   (ITodoListUser.IRequest)
 * @returns Paginated list of user summaries (id, email, name, avatar, status,
 *   last login, created_at)
 * @throws {HttpException} On error or if parameters are invalid
 */
export async function patchtodoListAdminUsers(props: {
  admin: AdminPayload;
  body: ITodoListUser.IRequest;
}): Promise<IPageITodoListUser.ISummary> {
  const { body } = props;

  // Allowed sort fields per schema
  const allowedSortFields = [
    "email",
    "created_at",
    "last_login_at",
    "name",
    "status",
  ];
  const sortField =
    body.sort_by && allowedSortFields.includes(body.sort_by)
      ? body.sort_by
      : "created_at";
  const sortDirection = body.direction === "asc" ? "asc" : "desc";
  const page = body.page ?? 1;
  const limit = body.limit ?? 20;

  // Prisma where filtering
  const where: Record<string, any> = {
    deleted_at: null,
    ...(body.email !== undefined &&
      body.email !== null && { email: body.email }),
    ...(body.status !== undefined &&
      body.status !== null && { status: body.status }),
    ...(body.name !== undefined &&
      body.name !== null && { name: { contains: body.name } }),
    // Date ranges
    ...((body.created_from !== undefined && body.created_from !== null) ||
    (body.created_to !== undefined && body.created_to !== null)
      ? {
          created_at: {
            ...(body.created_from !== undefined &&
              body.created_from !== null && { gte: body.created_from }),
            ...(body.created_to !== undefined &&
              body.created_to !== null && { lte: body.created_to }),
          },
        }
      : {}),
    ...((body.last_login_from !== undefined && body.last_login_from !== null) ||
    (body.last_login_to !== undefined && body.last_login_to !== null)
      ? {
          last_login_at: {
            ...(body.last_login_from !== undefined &&
              body.last_login_from !== null && {
                gte: body.last_login_from,
              }),
            ...(body.last_login_to !== undefined &&
              body.last_login_to !== null && {
                lte: body.last_login_to,
              }),
          },
        }
      : {}),
    // Free-text search across name/email only if provided
    ...(body.search !== undefined &&
    body.search !== null &&
    body.search.trim().length > 0
      ? {
          OR: [
            { name: { contains: body.search } },
            { email: { contains: body.search } },
          ],
        }
      : {}),
  };

  // Build query
  const [rows, total] = await Promise.all([
    MyGlobal.prisma.todo_list_users.findMany({
      where,
      orderBy: { [sortField]: sortDirection },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        avatar_uri: true,
        status: true,
        last_login_at: true,
        created_at: true,
      },
    }),
    MyGlobal.prisma.todo_list_users.count({ where }),
  ]);

  // Map results to ISummary with proper type and date conversions
  const data = rows.map((u) => {
    return {
      id: u.id,
      email: u.email,
      name: u.name ?? undefined,
      avatar_uri: u.avatar_uri ?? undefined,
      status: u.status,
      last_login_at:
        u.last_login_at !== null && u.last_login_at !== undefined
          ? toISOStringSafe(u.last_login_at)
          : undefined,
      created_at: toISOStringSafe(u.created_at),
    };
  });

  // Calculate pagination
  return {
    pagination: {
      current: Number(page),
      limit: Number(limit),
      records: total,
      pages: Math.ceil(total / limit),
    },
    data,
  };
}
