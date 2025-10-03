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

export async function postAuthAdminLogin(props: {
  body: ITodoListAdmin.ILogin;
}): Promise<ITodoListAdmin.IAuthorized> {
  const { email, password } = props.body;

  // 1. Find admin by email
  const admin = await MyGlobal.prisma.todo_list_admins.findUnique({
    where: { email },
  });
  if (!admin) {
    throw new HttpException("Invalid credentials", 401);
  }

  // 2. Check password
  const passwordValid = await PasswordUtil.verify(
    password,
    admin.password_hash,
  );
  if (!passwordValid) {
    throw new HttpException("Invalid credentials", 401);
  }

  // 3. Prepare expiration times
  const nowMs = Date.now();
  const accessExpiresAt = new Date(nowMs + 60 * 60 * 1000); // 1 hour
  const refreshExpiresAt = new Date(nowMs + 7 * 24 * 60 * 60 * 1000); // 7 days

  // 4. JWT claims
  const accessPayload = { id: admin.id, type: "admin" };
  const refreshPayload = { id: admin.id, type: "admin", tokenType: "refresh" };

  // 5. Generate tokens
  const access = jwt.sign(accessPayload, MyGlobal.env.JWT_SECRET_KEY, {
    expiresIn: "1h",
    issuer: "autobe",
  });
  const refresh = jwt.sign(refreshPayload, MyGlobal.env.JWT_SECRET_KEY, {
    expiresIn: "7d",
    issuer: "autobe",
  });

  // 6. Assemble token info
  const token = {
    access,
    refresh,
    expired_at: toISOStringSafe(accessExpiresAt),
    refreshable_until: toISOStringSafe(refreshExpiresAt),
  };

  // 7. Return authorized admin info
  return {
    id: admin.id,
    email: admin.email,
    created_at: toISOStringSafe(admin.created_at),
    updated_at: toISOStringSafe(admin.updated_at),
    token,
  };
}
