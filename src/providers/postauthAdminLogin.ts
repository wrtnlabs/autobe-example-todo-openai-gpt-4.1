import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { HttpException } from "@nestjs/common";
import { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";

/**
 * Authenticates administrator credentials (email, password) and issues JWT
 * access/refresh tokens.
 *
 * Validates that the provided email matches an existing admin (not
 * soft-deleted, status==='active'), verifies password securely via
 * MyGlobal.password, and issues JWT tokens if successful. Updates last_login_at
 * timestamp. Returns full admin profile and tokens.
 *
 * @param props - Request body containing admin email and password
 * @param props.body.email - Admin authentication email address
 * @param props.body.password - Raw password to verify against password_hash
 * @returns ITodoListAdmin.IAuthorized containing tokens and admin profile
 * @throws {HttpException} 400 on invalid credentials or inactive/locked/deleted
 *   accounts; generic error message only
 */
export async function postauthAdminLogin(props: {
  body: ITodoListAdmin.ILogin;
}): Promise<ITodoListAdmin.IAuthorized> {
  const { email, password } = props.body;

  // Find active, non-deleted admin by unique email
  const admin = await MyGlobal.prisma.todo_list_admins.findUnique({
    where: { email },
  });

  // Generic error (no info leakage) for not found, soft-deleted, or non-active
  if (!admin || admin.deleted_at !== null || admin.status !== "active") {
    throw new HttpException("Invalid email or password", 400);
  }

  // Secure password validation
  const passOk = await MyGlobal.password.verify(password, admin.password_hash);
  if (!passOk) {
    throw new HttpException("Invalid email or password", 400);
  }

  // Compute new login timestamp before updating
  const now: string & tags.Format<"date-time"> = toISOStringSafe(new Date());
  await MyGlobal.prisma.todo_list_admins.update({
    where: { id: admin.id },
    data: { last_login_at: now, updated_at: now },
  });

  // Prepare JWT payload & token values (no type assertions)
  const accessPayload = { id: admin.id, type: "admin" };
  const refreshPayload = { id: admin.id, type: "admin" };

  // Expiry times (fully typed, string only)
  const accessExpiresMs = 60 * 60 * 1000; // 1 hour
  const refreshExpiresMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  const expired_at = toISOStringSafe(new Date(Date.now() + accessExpiresMs));
  const refreshable_until = toISOStringSafe(
    new Date(Date.now() + refreshExpiresMs),
  );

  // JWT signing
  const access = jwt.sign(accessPayload, MyGlobal.env.JWT_SECRET_KEY, {
    expiresIn: "1h",
    issuer: "autobe",
  });
  const refresh = jwt.sign(refreshPayload, MyGlobal.env.JWT_SECRET_KEY, {
    expiresIn: "7d",
    issuer: "autobe",
  });

  return {
    id: admin.id,
    token: {
      access,
      refresh,
      expired_at,
      refreshable_until,
    },
    admin: {
      id: admin.id,
      email: admin.email,
      name: typeof admin.name === "string" ? admin.name : undefined,
      avatar_uri:
        typeof admin.avatar_uri === "string" ? admin.avatar_uri : undefined,
      status: admin.status,
      privilege_level: admin.privilege_level,
      last_admin_action_at: admin.last_admin_action_at
        ? toISOStringSafe(admin.last_admin_action_at)
        : undefined,
      last_login_at: now,
      created_at: toISOStringSafe(admin.created_at),
      updated_at: now,
      deleted_at: admin.deleted_at
        ? toISOStringSafe(admin.deleted_at)
        : undefined,
    },
  };
}
