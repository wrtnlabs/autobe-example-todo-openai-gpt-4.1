import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { HttpException } from "@nestjs/common";
import { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import { AdminPayload } from "../decorators/payload/AdminPayload";

/**
 * Retrieve detailed information for a specific Todo List administrator (table:
 * todo_list_admins)
 *
 * Returns full detail of an administrator account specified by adminId.
 * Requires caller to be authenticated as admin. Excludes sensitive
 * authentication data (password_hash). Supports admin management, auditing, and
 * profile review. Access denied for non-admins or missing/inactive/soft-deleted
 * accounts.
 *
 * @param props - Object containing the authenticated admin and target adminId
 * @param props.admin - Authenticated admin JWT payload
 * @param props.adminId - The unique identifier (UUID) of the target
 *   administrator account
 * @returns Detailed administrator account profile (excluding secrets)
 * @throws {HttpException} 404 if admin not found or is inactive/soft-deleted
 */
export async function gettodoListAdminAdminsAdminId(props: {
  admin: AdminPayload;
  adminId: string & tags.Format<"uuid">;
}): Promise<ITodoListAdmin> {
  const { adminId } = props;
  const admin = await MyGlobal.prisma.todo_list_admins.findFirst({
    where: {
      id: adminId,
      deleted_at: null,
      status: "active",
    },
  });
  if (!admin) {
    throw new HttpException("Admin not found", 404);
  }
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name ?? undefined,
    avatar_uri: admin.avatar_uri ?? undefined,
    status: admin.status,
    privilege_level: admin.privilege_level,
    last_admin_action_at: admin.last_admin_action_at
      ? toISOStringSafe(admin.last_admin_action_at)
      : undefined,
    last_login_at: admin.last_login_at
      ? toISOStringSafe(admin.last_login_at)
      : undefined,
    created_at: toISOStringSafe(admin.created_at),
    updated_at: toISOStringSafe(admin.updated_at),
    deleted_at: admin.deleted_at
      ? toISOStringSafe(admin.deleted_at)
      : undefined,
  };
}
