import { HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import typia, { tags } from "typia";
import { v4 } from "uuid";
import { MyGlobal } from "../MyGlobal";
import { PasswordUtil } from "../utils/PasswordUtil";
import { toISOStringSafe } from "../utils/toISOStringSafe";

import { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import { IPageITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListAdmin";
import { IPage } from "@ORGANIZATION/PROJECT-api/lib/structures/IPage";
import { AdminPayload } from "../decorators/payload/AdminPayload";

export async function patchTodoListAdminAdmins(props: {
  admin: AdminPayload;
  body: ITodoListAdmin.IRequest;
}): Promise<IPageITodoListAdmin.ISummary> {
  const { body } = props;
  const page = body.page ?? 1;
  const limit = body.limit ?? 100;
  const skip = (page - 1) * limit;

  // Parse and constrain sort/order
  const allowedSort: ("created_at" | "email")[] = ["created_at", "email"];
  const allowedOrder: ("asc" | "desc")[] = ["asc", "desc"];
  const sortField = allowedSort.includes(body.sort ?? "created_at")
    ? (body.sort ?? "created_at")
    : "created_at";
  const sortOrder = allowedOrder.includes(body.order ?? "desc")
    ? (body.order ?? "desc")
    : "desc";

  // Build Prisma where condition for partial email match
  const prismaWhere = {
    ...(body.email !== undefined &&
      body.email !== null &&
      body.email.length > 0 && {
        email: { contains: body.email },
      }),
  };

  // Query
  const [rows, total] = await Promise.all([
    MyGlobal.prisma.todo_list_admins.findMany({
      where: prismaWhere,
      orderBy: { [sortField]: sortOrder },
      skip,
      take: limit,
      select: {
        id: true,
        email: true,
        created_at: true,
      },
    }),
    MyGlobal.prisma.todo_list_admins.count({ where: prismaWhere }),
  ]);

  return {
    pagination: {
      current: Number(page),
      limit: Number(limit),
      records: Number(total),
      pages: Math.ceil(Number(total) / Number(limit)),
    },
    data: rows.map((admin) => ({
      id: admin.id,
      email: admin.email,
      created_at: toISOStringSafe(admin.created_at),
    })),
  };
}
