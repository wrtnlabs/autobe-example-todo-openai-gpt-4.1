import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { HttpException } from "@nestjs/common";
import { AdminPayload } from "../decorators/payload/AdminPayload";

/**
 * Permanently delete an administrator account from todo_list_admins (hard
 * delete).
 *
 * This operation performs a hard delete of the administrator account identified
 * by the adminId parameter. It is restricted to authenticated admins.
 *
 * The function checks if the target admin exists and is not soft-deleted
 * (deleted_at must be null). Errors are thrown if the admin does not exist or
 * has already been soft-deleted. On success, the admin record (row) is hard
 * deleted.
 *
 * @param props - Parameters for the admin deletion
 * @param props.admin - Authenticated admin performing the action
 * @param props.adminId - UUID of the administrator to delete
 * @returns Void
 * @throws {HttpException} 404 if admin not found, 400 if already soft-deleted,
 *   403 if actor is not admin
 */
export async function deletetodoListAdminAdminsAdminId(props: {
  admin: AdminPayload;
  adminId: string & tags.Format<"uuid">;
}): Promise<void> {
  const { admin, adminId } = props;

  // Ensure actor is authorized (must be admin type)
  if (admin.type !== "admin") {
    throw new HttpException("Forbidden: You are not an admin.", 403);
  }

  // Check if target admin exists and is NOT soft deleted
  const target = await MyGlobal.prisma.todo_list_admins.findFirst({
    where: {
      id: adminId,
      deleted_at: null,
    },
  });

  if (target === null) {
    // Could be not found, or already deleted
    // Additional select for soft-deleted state check
    const softDeleted = await MyGlobal.prisma.todo_list_admins.findFirst({
      where: { id: adminId },
      select: { deleted_at: true },
    });
    if (softDeleted && softDeleted.deleted_at !== null) {
      throw new HttpException("Admin account already soft deleted.", 400);
    }
    throw new HttpException("Admin account not found.", 404);
  }

  // Hard delete (permanently remove admin row)
  await MyGlobal.prisma.todo_list_admins.delete({
    where: { id: adminId },
  });
}
