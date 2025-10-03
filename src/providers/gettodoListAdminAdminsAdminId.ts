import { HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import typia, { tags } from "typia";
import { v4 } from "uuid";
import { MyGlobal } from "../MyGlobal";
import { PasswordUtil } from "../utils/PasswordUtil";
import { toISOStringSafe } from "../utils/toISOStringSafe";

import { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import { AdminPayload } from "../decorators/payload/AdminPayload";

export async function getTodoListAdminAdminsAdminId(props: {
  admin: AdminPayload;
  adminId: string & tags.Format<"uuid">;
}): Promise<ITodoListAdmin> {
  const row = await MyGlobal.prisma.todo_list_admins.findFirst({
    where: { id: props.adminId },
    select: {
      id: true,
      email: true,
      created_at: true,
      updated_at: true,
    },
  });
  if (!row) {
    throw new HttpException("Not Found", 404);
  }
  return {
    id: row.id,
    email: row.email,
    created_at: toISOStringSafe(row.created_at),
    updated_at: toISOStringSafe(row.updated_at),
  };
}
