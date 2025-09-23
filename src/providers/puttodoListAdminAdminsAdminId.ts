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
 * Update profile or status of an administrator account.
 *
 * Allows an authenticated admin to update fields (name, avatar URI, status,
 * privilege_level) of another admin by specifying adminId. Does NOT allow
 * changing password or email. Applies only if the target admin exists and is
 * not soft-deleted. Always updates updated_at. All output fields use correct
 * types and branding; never exposes password_hash.
 *
 * @param props - Parameters including the authenticated admin, adminId of
 *   target, and patch body.
 * @param props.admin - Authenticated admin making the request
 * @param props.adminId - UUID of the admin account to update
 * @param props.body - Patch fields for name, avatar_uri, status,
 *   privilege_level
 * @returns The updated admin account object
 * @throws {HttpException} When the target admin does not exist, is deleted, or
 *   on update conflict
 */
export async function puttodoListAdminAdminsAdminId(props: {
  admin: AdminPayload;
  adminId: string & tags.Format<"uuid">;
  body: ITodoListAdmin.IUpdate;
}): Promise<ITodoListAdmin> {
  // Find target admin, ensure active (not soft-deleted)
  const adminRecord = await MyGlobal.prisma.todo_list_admins.findFirst({
    where: {
      id: props.adminId,
      deleted_at: null,
    },
  });
  if (!adminRecord) {
    throw new HttpException("Admin not found or has been deleted", 404);
  }

  // Prepare update fields (never touch email/password_hash)
  const now: string & tags.Format<"date-time"> = toISOStringSafe(new Date());

  let updated;
  try {
    updated = await MyGlobal.prisma.todo_list_admins.update({
      where: { id: props.adminId },
      data: {
        name: "name" in props.body ? (props.body.name ?? null) : undefined,
        avatar_uri:
          "avatar_uri" in props.body
            ? (props.body.avatar_uri ?? null)
            : undefined,
        status: "status" in props.body ? props.body.status : undefined,
        privilege_level:
          "privilege_level" in props.body
            ? props.body.privilege_level
            : undefined,
        updated_at: now,
      },
    });
  } catch (err) {
    // Handle e.g. unique constraint violation or invalid updates
    throw new HttpException("Failed to update admin account", 400);
  }

  return {
    id: updated.id,
    email: updated.email,
    name: Object.prototype.hasOwnProperty.call(updated, "name")
      ? (updated.name ?? null)
      : undefined,
    avatar_uri: Object.prototype.hasOwnProperty.call(updated, "avatar_uri")
      ? (updated.avatar_uri ?? null)
      : undefined,
    status: updated.status,
    privilege_level: updated.privilege_level,
    last_admin_action_at: Object.prototype.hasOwnProperty.call(
      updated,
      "last_admin_action_at",
    )
      ? updated.last_admin_action_at
        ? toISOStringSafe(updated.last_admin_action_at)
        : null
      : undefined,
    last_login_at: Object.prototype.hasOwnProperty.call(
      updated,
      "last_login_at",
    )
      ? updated.last_login_at
        ? toISOStringSafe(updated.last_login_at)
        : null
      : undefined,
    created_at: toISOStringSafe(updated.created_at),
    updated_at: toISOStringSafe(updated.updated_at),
    deleted_at: Object.prototype.hasOwnProperty.call(updated, "deleted_at")
      ? updated.deleted_at
        ? toISOStringSafe(updated.deleted_at)
        : null
      : undefined,
  };
}
