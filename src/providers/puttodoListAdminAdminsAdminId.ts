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

export async function putTodoListAdminAdminsAdminId(props: {
  admin: AdminPayload;
  adminId: string & tags.Format<"uuid">;
  body: ITodoListAdmin.IUpdate;
}): Promise<ITodoListAdmin> {
  // Auth is ensured by decorator.
  // 1. Check existence of target adminId
  const original = await MyGlobal.prisma.todo_list_admins.findUnique({
    where: { id: props.adminId },
  });
  if (!original) {
    throw new HttpException("Admin not found", 404);
  }
  // 2. Check: do not allow updating id
  // (id is not present in body by DTO/type design)
  // 3. Prepare updated_at
  const updated_at = toISOStringSafe(new Date());
  // 4. Update
  const updated = await MyGlobal.prisma.todo_list_admins.update({
    where: { id: props.adminId },
    data: {
      email: props.body.email ?? undefined,
      password_hash: props.body.password_hash ?? undefined,
      updated_at: updated_at,
    },
  });
  // 5. Return as ITodoListAdmin - convert date fields
  return {
    id: updated.id,
    email: updated.email,
    created_at: toISOStringSafe(updated.created_at),
    updated_at: updated_at,
  };
}
