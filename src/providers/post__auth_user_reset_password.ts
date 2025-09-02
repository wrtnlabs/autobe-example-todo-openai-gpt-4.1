import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Complete password reset for 'user' (validate and consume reset token, set new
 * password, revoke all sessions).
 *
 * This endpoint finalizes the password reset process for a user by accepting
 * the reset token, new password, and relevant user ID. The token must be valid,
 * not expired, unused, and must belong to the given user. The user must not be
 * soft-deleted. On success, the user's password_hash and updated_at are set,
 * the reset token is consumed, and all active sessions are revoked. This
 * operation does not issue tokens. Users must log in again after reset. All
 * date/datetime values use the proper branded string type.
 *
 * @param props - Request properties
 * @param props.body - Password reset confirmation payload (reset token, user
 *   ID, new password).
 * @returns Success result or error description.
 * @throws {Error} On unexpected errors or database failures
 */
export async function post__auth_user_reset_password(props: {
  body: ITodoListUser.IResetPassword;
}): Promise<ITodoListUser.IResetPasswordResult> {
  const { token, user_id, new_password } = props.body;
  const now: string & tags.Format<"date-time"> = toISOStringSafe(new Date());

  // Step 1: Validate reset token existence and state
  const resetToken =
    await MyGlobal.prisma.todo_list_password_reset_tokens.findFirst({
      where: {
        token,
        todo_list_user_id: user_id,
        used_at: null,
        expires_at: { gt: now },
      },
    });
  if (!resetToken) {
    return {
      success: false,
      error: "Invalid or expired password reset token.",
    };
  }

  // Step 2: Ensure user exists and is not soft-deleted
  const user = await MyGlobal.prisma.todo_list_users.findFirst({
    where: { id: user_id, deleted_at: null },
  });
  if (!user) {
    return {
      success: false,
      error: "User not found or account is deactivated.",
    };
  }

  // Step 3: Securely hash the new password
  const hashedPassword: string = await MyGlobal.password.hash(new_password);

  // Step 4: Update user's password_hash and updated_at
  await MyGlobal.prisma.todo_list_users.update({
    where: { id: user_id },
    data: {
      password_hash: hashedPassword,
      updated_at: now,
    },
  });

  // Step 5: Mark the reset token as used (only once)
  await MyGlobal.prisma.todo_list_password_reset_tokens.update({
    where: { id: resetToken.id },
    data: {
      used_at: now,
    },
  });

  // Step 6: Revoke all active sessions for this user (security compliance)
  await MyGlobal.prisma.todo_list_auth_sessions.updateMany({
    where: {
      todo_list_user_id: user_id,
      revoked_at: null,
      expires_at: { gt: now },
    },
    data: {
      revoked_at: now,
    },
  });

  return { success: true };
}
