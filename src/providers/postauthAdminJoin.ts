import { HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import typia, { tags } from "typia";
import { v4 } from "uuid";
import { MyGlobal } from "../MyGlobal";
import { PasswordUtil } from "../utils/PasswordUtil";
import { toISOStringSafe } from "../utils/toISOStringSafe";

import { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";

export async function postAuthAdminJoin(props: {
  body: ITodoListAdmin.ICreate;
}): Promise<ITodoListAdmin.IAuthorized> {
  const { email, password } = props.body;

  // Check for duplicate email
  const exists = await MyGlobal.prisma.todo_list_admins.findUnique({
    where: { email },
    select: { id: true },
  });
  if (exists) {
    throw new HttpException("Duplicate email: already registered", 409);
  }

  // Hash password
  const password_hash = await PasswordUtil.hash(password);

  // Generate IDs, timestamps
  const id = v4();
  const now = toISOStringSafe(new Date());

  // Create admin
  const admin = await MyGlobal.prisma.todo_list_admins.create({
    data: {
      id,
      email,
      password_hash,
      created_at: now,
      updated_at: now,
    },
    select: {
      id: true,
      email: true,
      created_at: true,
      updated_at: true,
    },
  });

  // Token expiry computation
  const accessTokenExpiresInSeconds = 3600;
  const refreshTokenExpiresInSeconds = 604800;
  const accessExpiredAt = toISOStringSafe(
    new Date(Date.now() + accessTokenExpiresInSeconds * 1000),
  );
  const refreshableUntil = toISOStringSafe(
    new Date(Date.now() + refreshTokenExpiresInSeconds * 1000),
  );

  // Issue JWT tokens
  const access = jwt.sign(
    { id: admin.id, type: "admin" },
    MyGlobal.env.JWT_SECRET_KEY,
    { expiresIn: accessTokenExpiresInSeconds, issuer: "autobe" },
  );
  const refresh = jwt.sign(
    { id: admin.id, type: "admin", tokenType: "refresh" },
    MyGlobal.env.JWT_SECRET_KEY,
    { expiresIn: refreshTokenExpiresInSeconds, issuer: "autobe" },
  );

  return {
    id: admin.id,
    email: admin.email,
    created_at: toISOStringSafe(admin.created_at),
    updated_at: toISOStringSafe(admin.updated_at),
    token: {
      access,
      refresh,
      expired_at: accessExpiredAt,
      refreshable_until: refreshableUntil,
    },
  };
}
