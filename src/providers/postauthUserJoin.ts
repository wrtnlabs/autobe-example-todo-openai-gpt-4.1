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

export async function postAuthUserJoin(props: {
  body: ITodoListUser.IJoin;
}): Promise<ITodoListUser.IAuthorized> {
  const { email, password } = props.body;
  // Step 1: Check for duplicate email
  const existing = await MyGlobal.prisma.todo_list_users.findUnique({
    where: { email },
  });
  if (existing !== null) {
    throw new HttpException("Email already registered.", 409);
  }

  // Step 2: Hash password securely
  const password_hash = await PasswordUtil.hash(password);

  // Step 3: Generate user id and timestamps
  const id = v4();
  const now = toISOStringSafe(new Date());

  // Step 4: Insert user
  const user = await MyGlobal.prisma.todo_list_users.create({
    data: {
      id,
      email,
      password_hash,
      created_at: now,
      updated_at: now,
    },
  });

  // Step 5: Compute token expiry
  const access_expiry = new Date(Date.now() + 60 * 60 * 1000);
  const refresh_expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const access_token = jwt.sign(
    { id: user.id, type: "user" },
    MyGlobal.env.JWT_SECRET_KEY,
    { expiresIn: "1h", issuer: "autobe" },
  );
  const refresh_token = jwt.sign(
    { id: user.id, type: "user" },
    MyGlobal.env.JWT_SECRET_KEY,
    { expiresIn: "7d", issuer: "autobe" },
  );

  // Step 6: Return authorized user DTO with token group
  return {
    id: user.id,
    email: user.email,
    created_at: toISOStringSafe(user.created_at),
    updated_at: toISOStringSafe(user.updated_at),
    token: {
      access: access_token,
      refresh: refresh_token,
      expired_at: toISOStringSafe(access_expiry),
      refreshable_until: toISOStringSafe(refresh_expiry),
    },
  };
}
