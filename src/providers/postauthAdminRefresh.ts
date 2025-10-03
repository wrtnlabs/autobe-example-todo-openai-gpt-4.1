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

export async function postAuthAdminRefresh(props: {
  body: ITodoListAdmin.IRefresh;
}): Promise<ITodoListAdmin.IAuthorized> {
  const { body } = props;

  let decoded: { id: string; type: string };
  try {
    decoded = jwt.verify(body.refresh_token, MyGlobal.env.JWT_SECRET_KEY, {
      issuer: "autobe",
    }) as { id: string; type: string };
  } catch {
    throw new HttpException("Invalid or expired refresh token", 401);
  }
  if (!decoded || decoded.type !== "admin" || !decoded.id) {
    throw new HttpException("Invalid admin refresh token", 401);
  }

  const admin = await MyGlobal.prisma.todo_list_admins.findUnique({
    where: { id: decoded.id },
  });
  if (!admin) {
    throw new HttpException("Admin not found", 401);
  }

  // Compute expiration date-time fields as ISO 8601 strings
  const nowEpoch = Date.now();
  const accessLifespanMs = 60 * 60 * 1000; // 1 hour
  const refreshLifespanMs = 7 * 24 * 60 * 60 * 1000; // 7 days

  const expired_at = toISOStringSafe(new Date(nowEpoch + accessLifespanMs));
  const refreshable_until = toISOStringSafe(
    new Date(nowEpoch + refreshLifespanMs),
  );

  const access = jwt.sign(
    { id: admin.id, type: "admin" },
    MyGlobal.env.JWT_SECRET_KEY,
    {
      expiresIn: "1h",
      issuer: "autobe",
    },
  );
  const refresh = jwt.sign(
    { id: admin.id, type: "admin" },
    MyGlobal.env.JWT_SECRET_KEY,
    {
      expiresIn: "7d",
      issuer: "autobe",
    },
  );

  return {
    id: admin.id,
    email: admin.email,
    created_at: toISOStringSafe(admin.created_at),
    updated_at: toISOStringSafe(admin.updated_at),
    token: {
      access,
      refresh,
      expired_at,
      refreshable_until,
    },
  };
}
