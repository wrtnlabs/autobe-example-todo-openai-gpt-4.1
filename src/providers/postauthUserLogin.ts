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

export async function postAuthUserLogin(props: {
  body: ITodoListUser.ILogin;
}): Promise<ITodoListUser.IAuthorized> {
  const { email, password } = props.body;
  // 1. Find user by unique email
  const user = await MyGlobal.prisma.todo_list_users.findUnique({
    where: { email },
  });
  if (!user) throw new HttpException("Invalid credentials", 403);

  // 2. Password check using PasswordUtil
  const valid = await PasswordUtil.verify(password, user.password_hash);
  if (!valid) throw new HttpException("Invalid credentials", 403);

  // 3. Update 'updated_at' field with current timestamp (toISOStringSafe)
  const now = toISOStringSafe(new Date());
  await MyGlobal.prisma.todo_list_users.update({
    where: { id: user.id },
    data: { updated_at: now },
  });

  // 4. Generate JWT tokens with proper payload/issuer/expiration
  const jwtPayload = { id: user.id, type: "user" };
  const access = jwt.sign(jwtPayload, MyGlobal.env.JWT_SECRET_KEY, {
    expiresIn: "1h",
    issuer: "autobe",
  });
  const refresh = jwt.sign(jwtPayload, MyGlobal.env.JWT_SECRET_KEY, {
    expiresIn: "7d",
    issuer: "autobe",
  });

  // 5. Compute exact token expiry times (ISO format)
  const accessExpired = toISOStringSafe(new Date(Date.now() + 60 * 60 * 1000));
  const refreshExpired = toISOStringSafe(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  );

  return {
    id: user.id,
    email: user.email,
    created_at: toISOStringSafe(user.created_at),
    updated_at: now,
    token: {
      access: access,
      refresh: refresh,
      expired_at: accessExpired,
      refreshable_until: refreshExpired,
    },
  };
}
