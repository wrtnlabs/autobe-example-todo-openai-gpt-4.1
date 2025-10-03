import { HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import typia, { tags } from "typia";
import { v4 } from "uuid";
import { MyGlobal } from "../MyGlobal";
import { PasswordUtil } from "../utils/PasswordUtil";
import { toISOStringSafe } from "../utils/toISOStringSafe";

import { AdminPayload } from "../decorators/payload/AdminPayload";

export async function deleteTodoListAdminAdminsAdminId(props: {
  admin: AdminPayload;
  adminId: string & tags.Format<"uuid">;
}): Promise<void> {
  // Step 1: Confirm admin exists
  const admin = await MyGlobal.prisma.todo_list_admins.findUnique({
    where: { id: props.adminId },
    select: { id: true },
  });
  if (!admin) {
    throw new HttpException("Admin not found", 404);
  }
  // Step 2: Count admins (to prevent deleting last admin)
  const adminCount = await MyGlobal.prisma.todo_list_admins.count();
  if (adminCount <= 1) {
    throw new HttpException(
      "At least one admin account must remain. Deletion was cancelled.",
      409,
    );
  }
  // Step 3: Hard delete
  await MyGlobal.prisma.todo_list_admins.delete({
    where: { id: props.adminId },
  });
}
