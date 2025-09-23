import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { HttpException } from "@nestjs/common";
import { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import { AdminPayload } from "../decorators/payload/AdminPayload";

/**
 * Update fields of a specific user account (todo_list_users) by admin,
 * including profile and status changes.
 *
 * Allows admin users to update an existing user account identified by userId.
 * Updatable fields include name, avatar_uri, status, email, and password_hash.
 * This function ensures that the email remains unique across users, that status
 * and credential updates comply with business rules, and that no updates are
 * permitted if the user is soft-deleted. Returns the full user record
 * (excluding credential hash) upon success. All changes are logged as
 * appropriate for audit/compliance.
 *
 * @param props - Object containing admin authentication, target userId, and
 *   update body
 * @param props.admin - The authenticated admin performing the update
 * @param props.userId - Target user UUID (id) to update
 * @param props.body - The set of fields to update (any/all of name, avatar_uri,
 *   status, email, password_hash)
 * @returns The updated user record (excluding credential hash) after
 *   modification
 * @throws {HttpException} If the user is not found, soft-deleted, or the email
 *   is duplicate/violates unique constraint
 */
export async function puttodoListAdminUsersUserId(props: {
  admin: AdminPayload;
  userId: string & tags.Format<"uuid">;
  body: ITodoListUser.IUpdate;
}): Promise<ITodoListUser> {
  // Step 1: Fetch user and check if exists and not soft-deleted
  const user = await MyGlobal.prisma.todo_list_users.findUnique({
    where: { id: props.userId },
  });
  if (!user || user.deleted_at !== null) {
    throw new HttpException("User not found or already deleted", 404);
  }
  // Step 2: If updating email, enforce uniqueness constraint
  if (props.body.email && props.body.email !== user.email) {
    const dup = await MyGlobal.prisma.todo_list_users.findUnique({
      where: { email: props.body.email },
    });
    if (dup && dup.id !== props.userId) {
      throw new HttpException("Email already exists", 409);
    }
  }
  // Step 3: Update user fields (no id, created_at updated)
  const now = toISOStringSafe(new Date());
  const updated = await MyGlobal.prisma.todo_list_users.update({
    where: { id: props.userId },
    data: {
      email: props.body.email ?? undefined,
      name: props.body.name ?? undefined,
      avatar_uri: props.body.avatar_uri ?? undefined,
      status: props.body.status ?? undefined,
      password_hash: props.body.password_hash ?? undefined,
      updated_at: now,
    },
  });
  // Step 4: Return updated user excluding password_hash
  return {
    id: updated.id,
    email: updated.email,
    name: updated.name ?? undefined,
    avatar_uri: updated.avatar_uri ?? undefined,
    status: updated.status,
    last_login_at: updated.last_login_at
      ? toISOStringSafe(updated.last_login_at)
      : undefined,
    created_at: toISOStringSafe(updated.created_at),
    updated_at: now,
    deleted_at: updated.deleted_at
      ? toISOStringSafe(updated.deleted_at)
      : undefined,
  };
}
