import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { HttpException } from "@nestjs/common";
import { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Renew JWT session tokens for a user by validating a refresh token against
 * todo_list_users.
 *
 * Accepts a valid refresh token (issued at login or join). If valid and the
 * referenced user account is active (status is 'active', deleted_at is null),
 * returns fresh JWT access and refresh tokens along with the full user profile.
 * Denies token refresh on any error/invalid/expired token or
 * ineligible/inactive/deleted user account.
 *
 * @param props - Contains the refresh_token to use for session renewal
 * @returns The authorized session object containing user ID, renewed tokens,
 *   and user profile
 * @throws {HttpException} 401 if token is invalid, expired, or user is
 *   ineligible
 */
export async function postauthUserRefresh(props: {
  body: ITodoListUser.IRefresh;
}): Promise<ITodoListUser.IAuthorized> {
  const { refresh_token } = props.body;
  let decoded: { id: string; type: string };

  // Step 1: Verify and decode refresh_token
  try {
    decoded = jwt.verify(refresh_token, MyGlobal.env.JWT_SECRET_KEY, {
      issuer: "autobe",
    }) as { id: string; type: string };
  } catch (err: unknown) {
    throw new HttpException("Invalid or expired refresh token", 401);
  }

  // Step 2: Validate token type and existence
  if (!decoded || decoded.type !== "user" || !decoded.id) {
    throw new HttpException("Invalid refresh token payload", 401);
  }

  // Step 3: Lookup user account (must be active, not deleted)
  const user = await MyGlobal.prisma.todo_list_users.findUnique({
    where: { id: decoded.id },
  });
  if (!user || user.status !== "active" || user.deleted_at !== null) {
    throw new HttpException("User account not eligible for refresh", 401);
  }

  // Step 4: Prepare timestamps for token expiry (in ms)
  const now = Date.now();
  const accessExpiresInSec = 60 * 30; // 30 minutes
  const refreshExpiresInSec = 60 * 60 * 24 * 7; // 7 days
  const accessExpiredAt = new Date(now + accessExpiresInSec * 1000);
  const refreshExpiredAt = new Date(now + refreshExpiresInSec * 1000);

  // Step 5: Issue new access and refresh JWTs
  const accessPayload = {
    id: user.id,
    type: "user",
  };
  const access = jwt.sign(accessPayload, MyGlobal.env.JWT_SECRET_KEY, {
    expiresIn: accessExpiresInSec,
    issuer: "autobe",
  });
  const refresh = jwt.sign(accessPayload, MyGlobal.env.JWT_SECRET_KEY, {
    expiresIn: refreshExpiresInSec,
    issuer: "autobe",
  });

  // Step 6: Assemble return struct (no Date types, no assertions)
  const token = {
    access: access,
    refresh: refresh,
    expired_at: toISOStringSafe(accessExpiredAt),
    refreshable_until: toISOStringSafe(refreshExpiredAt),
  };

  const userProfile = {
    id: user.id,
    email: user.email,
    name: user.name === undefined ? undefined : user.name,
    avatar_uri: user.avatar_uri === undefined ? undefined : user.avatar_uri,
    status: user.status,
    last_login_at:
      user.last_login_at !== null && user.last_login_at !== undefined
        ? toISOStringSafe(user.last_login_at)
        : null,
    created_at: toISOStringSafe(user.created_at),
    updated_at: toISOStringSafe(user.updated_at),
    deleted_at:
      user.deleted_at !== null && user.deleted_at !== undefined
        ? toISOStringSafe(user.deleted_at)
        : null,
  };

  return {
    id: user.id,
    token: token,
    user: userProfile,
  };
}
