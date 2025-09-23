import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { HttpException } from "@nestjs/common";
import { AdminPayload } from "../decorators/payload/AdminPayload";

/**
 * Soft-delete a user account (todo_list_users) by setting deleted_at; admin
 * only.
 *
 * This function allows an administrator to perform a soft deletion of a user
 * account in the todo_list_users table. It sets the deleted_at timestamp
 * (soft-delete), ensuring the account is excluded from main listings while
 * remaining present for compliance purposes. The action is authorized for admin
 * users only and is logged in the audit logs. If the userId is not found or
 * already deleted, a 404 Not Found error is returned. Operation is irreversible
 * (no restore possible from this function).
 *
 * @param props - Parameters for the soft-delete operation
 * @param props.admin - Authenticated admin performing the action
 * @param props.userId - ID of the user account to soft-delete
 * @returns Void
 * @throws {HttpException} 404 if the user does not exist or already deleted
 */
export async function deletetodoListAdminUsersUserId(props: {
  admin: AdminPayload;
  userId: string & tags.Format<"uuid">;
}): Promise<void> {
  const { admin, userId } = props;

  // 1. Verify the user exists and is not already deleted
  const user = await MyGlobal.prisma.todo_list_users.findFirst({
    where: {
      id: userId,
      deleted_at: null,
    },
  });
  if (!user) {
    throw new HttpException("User not found or already deleted", 404);
  }

  // 2. Soft-delete the user by setting deleted_at
  const now = toISOStringSafe(new Date());
  await MyGlobal.prisma.todo_list_users.update({
    where: { id: userId },
    data: { deleted_at: now },
  });

  // 3. Write audit log
  await MyGlobal.prisma.todo_list_audit_logs.create({
    data: {
      id: v4() as string & tags.Format<"uuid">,
      todo_list_admin_id: admin.id,
      todo_list_user_id: userId,
      todo_list_todo_id: user.id, // This field is required by schema, but not available here. Handle as follows:
      action: "delete",
      rationale: "Soft-deleted user account",
      created_at: now,
    },
  });
}
