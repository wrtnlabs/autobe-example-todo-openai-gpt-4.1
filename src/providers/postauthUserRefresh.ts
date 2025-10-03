import { HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import typia, { tags } from "typia";
import { v4 } from "uuid";
import { MyGlobal } from "../MyGlobal";
import { PasswordUtil } from "../utils/PasswordUtil";
import { toISOStringSafe } from "../utils/toISOStringSafe";

import { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";

export async function postAuthUserRefresh(props: {
  body: ITodoListUser.IRefresh;
}): Promise<ITodoListUser.IAuthorized> {
  const { refresh_token } = props.body;
  let decoded: any;
  try {
    decoded = jwt.verify(refresh_token, MyGlobal.env.JWT_SECRET_KEY, {
      issuer: "autobe",
    });
  } catch (err) {
    throw new HttpException("Invalid or expired refresh token", 401);
  }

  if (
    !decoded ||
    typeof decoded !== "object" ||
    decoded.type !== "user" ||
    !decoded.id
  ) {
    throw new HttpException("Invalid refresh token", 401);
  }

  const user = await MyGlobal.prisma.todo_list_users.findUnique({
    where: { id: decoded.id },
  });
  if (!user) {
    throw new HttpException("User not found for refresh token", 401);
  }

  // Now, rotate tokens
  const now = new Date();
  const accessExpires = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
  const refreshExpires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const access = jwt.sign(
    { id: user.id, type: "user" },
    MyGlobal.env.JWT_SECRET_KEY,
    { expiresIn: "1h", issuer: "autobe" },
  );
  const refresh = jwt.sign(
    { id: user.id, type: "user" },
    MyGlobal.env.JWT_SECRET_KEY,
    { expiresIn: "7d", issuer: "autobe" },
  );

  // Update user's updated_at
  await MyGlobal.prisma.todo_list_users.update({
    where: { id: user.id },
    data: { updated_at: toISOStringSafe(now) },
  });

  return {
    id: user.id,
    email: user.email,
    created_at: toISOStringSafe(user.created_at),
    updated_at: toISOStringSafe(now),
    token: {
      access,
      refresh,
      expired_at: toISOStringSafe(accessExpires),
      refreshable_until: toISOStringSafe(refreshExpires),
    },
  };
}
