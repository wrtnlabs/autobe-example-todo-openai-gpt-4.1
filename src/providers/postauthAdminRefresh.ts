import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { HttpException } from "@nestjs/common";
import { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";

/**
 * Refreshes administrator JWT tokens using a valid refresh token.
 *
 * This endpoint allows an authenticated admin to obtain new access and refresh
 * tokens by presenting a valid, non-expired, and non-revoked refresh token. The
 * refresh logic verifies the admin exists, is not deleted/suspended, and is
 * using an up-to-date privilege/status. All expiration times are provided as
 * ISO date-time strings with proper branding.
 *
 * @param props - Request containing { body: { refresh_token } }
 * @returns New JWT access/refresh tokens and full admin profile as
 *   ITodoListAdmin.IAuthorized DTO
 * @throws {HttpException} When refresh_token is invalid, expired, admin is not
 *   found, or admin is inactive/deleted
 */
export async function postauthAdminRefresh(props: {
  body: ITodoListAdmin.IRefresh;
}): Promise<ITodoListAdmin.IAuthorized> {
  const { refresh_token } = props.body;
  let decoded: { id: string; type: string };
  try {
    decoded = jwt.verify(refresh_token, MyGlobal.env.JWT_SECRET_KEY, {
      issuer: "autobe",
    }) as { id: string; type: string };
  } catch {
    throw new HttpException("Invalid or expired refresh token", 401);
  }

  // Validate JWT payload format
  if (!decoded || !decoded.id || decoded.type !== "admin") {
    throw new HttpException("Malformed refresh token payload", 401);
  }

  // Fetch admin by id
  const admin = await MyGlobal.prisma.todo_list_admins.findUnique({
    where: { id: decoded.id },
  });
  if (!admin || admin.deleted_at !== null || admin.status !== "active") {
    throw new HttpException("Admin not found, deleted, or not active", 403);
  }

  // Token expiry
  const accessTokenTtlSeconds = 60 * 60; // 1h
  const refreshTokenTtlSeconds = 60 * 60 * 24 * 7; // 7d
  const now = new Date();
  const expiredAt = toISOStringSafe(
    new Date(now.getTime() + accessTokenTtlSeconds * 1000),
  );
  const refreshableUntil = toISOStringSafe(
    new Date(now.getTime() + refreshTokenTtlSeconds * 1000),
  );

  // Access token: payload structure must match AdminPayload
  const accessToken = jwt.sign(
    { id: admin.id, type: "admin" },
    MyGlobal.env.JWT_SECRET_KEY,
    {
      expiresIn: accessTokenTtlSeconds,
      issuer: "autobe",
    },
  );

  // Rotate refresh token
  const refreshToken = jwt.sign(
    { id: admin.id, type: "admin" },
    MyGlobal.env.JWT_SECRET_KEY,
    {
      expiresIn: refreshTokenTtlSeconds,
      issuer: "autobe",
    },
  );

  // Compose IAuthorizationToken (all ISO strings)
  const token = {
    access: accessToken,
    refresh: refreshToken,
    expired_at: expiredAt,
    refreshable_until: refreshableUntil,
  };

  // Compose ITodoListAdmin DTO
  const adminProfile = {
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

  return {
    id: admin.id,
    token,
    admin: adminProfile,
  };
}
