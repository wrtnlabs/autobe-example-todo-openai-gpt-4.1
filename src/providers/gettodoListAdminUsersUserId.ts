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
 * Retrieve a specific user's detailed profile (todo_list_users table) using
 * their unique userId.
 *
 * Allows an admin to access all non-sensitive details of any user for support,
 * compliance, or operational purposes. Excludes password hashes. Only
 * accessible by admin role; throws 404 if the user does not exist or is soft
 * deleted. All access must be strictly authorized and subject to audit
 * logging.
 *
 * @param props - The parameters for the request.
 * @param props.admin - The authenticated admin making the request.
 * @param props.userId - The UUID of the user to be retrieved.
 * @returns Full non-sensitive profile information for the requested user.
 * @throws {HttpException} If the user is not found or is soft deleted.
 */
export async function gettodoListAdminUsersUserId(props: {
  admin: AdminPayload;
  userId: string & tags.Format<"uuid">;
}): Promise<ITodoListUser> {
  const record = await MyGlobal.prisma.todo_list_users.findFirst({
    where: {
      id: props.userId,
      deleted_at: null,
    },
  });

  if (!record) {
    throw new HttpException("User not found", 404);
  }

  return {
    id: record.id,
    email: record.email,
    name: record.name ?? undefined,
    avatar_uri: record.avatar_uri ?? undefined,
    status: record.status,
    last_login_at: record.last_login_at
      ? toISOStringSafe(record.last_login_at)
      : undefined,
    created_at: toISOStringSafe(record.created_at),
    updated_at: toISOStringSafe(record.updated_at),
    deleted_at: record.deleted_at
      ? toISOStringSafe(record.deleted_at)
      : undefined,
  };
}
