import { HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import typia, { tags } from "typia";
import { v4 } from "uuid";
import { MyGlobal } from "../MyGlobal";
import { PasswordUtil } from "../utils/PasswordUtil";
import { toISOStringSafe } from "../utils/toISOStringSafe";

import { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import { IPageITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListUser";
import { IPage } from "@ORGANIZATION/PROJECT-api/lib/structures/IPage";
import { AdminPayload } from "../decorators/payload/AdminPayload";

export async function patchTodoListAdminUsers(props: {
  admin: AdminPayload;
  body: ITodoListUser.IRequest;
}): Promise<IPageITodoListUser.ISummary> {
  const { body } = props;
  const page = typeof body.page === "number" && body.page > 0 ? body.page : 1;
  const limit =
    typeof body.limit === "number" && body.limit > 0 ? body.limit : 100;

  const email =
    typeof body.email === "string" && body.email.length > 0
      ? body.email
      : undefined;
  let sortField: "created_at" | "email" = "created_at";
  if (body.sort === "created_at" || body.sort === "email")
    sortField = body.sort;
  let order: "asc" | "desc" = "desc";
  if (body.order === "asc" || body.order === "desc") order = body.order;

  const where = email !== undefined ? { email: { contains: email } } : {};

  // Inline orderBy - only supported fields
  const orderBy =
    sortField === "email" ? { email: order } : { created_at: order };

  const total = await MyGlobal.prisma.todo_list_users.count({ where });
  const users = await MyGlobal.prisma.todo_list_users.findMany({
    where,
    orderBy,
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id: true,
      email: true,
      created_at: true,
    },
  });

  const data = users.map((user) => ({
    id: user.id,
    email: user.email,
    created_at: toISOStringSafe(user.created_at),
  }));

  return {
    pagination: {
      current: Number(page),
      limit: Number(limit),
      records: total,
      pages: Math.ceil(total / Number(limit)),
    },
    data,
  };
}
