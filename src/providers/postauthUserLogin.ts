import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { HttpException } from "@nestjs/common";
import { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Authenticate a user from todo_list_users, issue new JWT session tokens (role:
 * user)
 *
 * This endpoint authenticates an existing user account (email + password)
 * against the todo_list_users table. It allows login only for users with status
 * 'active' and deleted_at null. On success, updates last_login_at and returns a
 * fully normalized ITodoListUser.IAuthorized (user object and tokens). JWT
 * tokens contain id and role:type 'user', issuer is always 'autobe'. All
 * date/datetime values are string & tags.Format<'date-time'>.
 *
 * @param props - Login properties
 * @param props.body - Login payload: email and password
 * @returns ITodoListUser.IAuthorized containing user id, profile (minus
 *   credential fields), and JWT tokens
 * @throws {HttpException} For any login failure (generic message)
 */
export async function postauthUserLogin(props: {
  body: ITodoListUser.ILogin;
}): Promise<ITodoListUser.IAuthorized> {
  const { email, password } = props.body;

  // 1. Fetch user by email (including deleted), error on missing
  const user = await MyGlobal.prisma.todo_list_users.findUnique({
    where: { email },
  });

  // Uniform error message
  const error = new HttpException("Invalid email or password", 401);

  // 2. Check for user existence and valid status
  if (!user || user.status !== "active" || user.deleted_at !== null) {
    throw error;
  }

  // 3. Password check (MyGlobal.password.verify handles hashes)
  const valid = await MyGlobal.password.verify(password, user.password_hash);
  if (!valid) throw error;

  // 4. Generate new last_login_at as ISO string
  const now = toISOStringSafe(new Date());

  // 5. Update last_login_at in DB
  await MyGlobal.prisma.todo_list_users.update({
    where: { id: user.id },
    data: { last_login_at: now },
  });

  // 6. Generate JWT access and refresh tokens
  // Token expiresIn: 1h, refresh: 7d, issuer: 'autobe'.
  const accessTokenExp = new Date(Date.now() + 60 * 60 * 1000);
  const refreshTokenExp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const accessToken = jwt.sign(
    { id: user.id, type: "user" },
    MyGlobal.env.JWT_SECRET_KEY,
    { expiresIn: "1h", issuer: "autobe" },
  );
  const refreshToken = jwt.sign(
    { id: user.id, type: "user" },
    MyGlobal.env.JWT_SECRET_KEY,
    { expiresIn: "7d", issuer: "autobe" },
  );

  // 7. Return ITodoListUser.IAuthorized
  return {
    id: user.id,
    token: {
      access: accessToken,
      refresh: refreshToken,
      expired_at: toISOStringSafe(accessTokenExp),
      refreshable_until: toISOStringSafe(refreshTokenExp),
    },
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      avatar_uri: user.avatar_uri ?? undefined,
      status: user.status,
      last_login_at: now,
      created_at: toISOStringSafe(user.created_at),
      updated_at: toISOStringSafe(user.updated_at),
      deleted_at: user.deleted_at
        ? toISOStringSafe(user.deleted_at)
        : undefined,
    },
  };
}
