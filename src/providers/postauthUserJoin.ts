import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { HttpException } from "@nestjs/common";
import { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Register a new user account in todo_list_users and provision JWT tokens
 * (role: user)
 *
 * Accepts registration fields (email, password, name, avatar_uri). Validates
 * email uniqueness (not soft-deleted), hashes password, sets default status,
 * and timestamps. Issues access/refresh JWT for new user and returns full
 * ITodoListUser.IAuthorized DTO with session info and profile (excluding
 * sensitive credentials).
 *
 * @param props - Registration properties
 * @param props.body - User registration data (email, password, optional
 *   name/avatar_uri)
 * @returns ITodoListUser.IAuthorized containing token, user context
 * @throws {HttpException} If email is already in use (status 409)
 */
export async function postauthUserJoin(props: {
  body: ITodoListUser.IJoin;
}): Promise<ITodoListUser.IAuthorized> {
  const { body } = props;
  // 1. Check email uniqueness (exclude soft-deleted)
  const existing = await MyGlobal.prisma.todo_list_users.findFirst({
    where: {
      email: body.email,
      deleted_at: null,
    },
    select: { id: true },
  });
  if (existing) {
    throw new HttpException("Email is already registered.", 409);
  }
  // 2. Hash password
  const password_hash = await MyGlobal.password.hash(body.password);
  // 3. Prepare fields
  const now = toISOStringSafe(new Date());
  const id = v4() as string & tags.Format<"uuid">;
  // 4. Insert user
  const created = await MyGlobal.prisma.todo_list_users.create({
    data: {
      id,
      email: body.email,
      password_hash,
      name: body.name ?? undefined,
      avatar_uri: body.avatar_uri ?? undefined,
      status: "active",
      created_at: now,
      updated_at: now,
      // last_login_at, deleted_at left undefined (default null)
    },
  });
  // 5. Generate JWT access/refresh tokens
  const accessExpires = new Date(Date.now() + 60 * 60 * 1000);
  const refreshExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const access = jwt.sign(
    { id: created.id, type: "user" },
    MyGlobal.env.JWT_SECRET_KEY,
    {
      expiresIn: "1h",
      issuer: "autobe",
    },
  );
  const refresh = jwt.sign(
    { id: created.id, type: "user" },
    MyGlobal.env.JWT_SECRET_KEY,
    {
      expiresIn: "7d",
      issuer: "autobe",
    },
  );
  // 6. Compose results (convert date fields, exclude password_hash)
  return {
    id: created.id,
    token: {
      access,
      refresh,
      expired_at: toISOStringSafe(accessExpires),
      refreshable_until: toISOStringSafe(refreshExpires),
    },
    user: {
      id: created.id,
      email: created.email,
      name: created.name ?? undefined,
      avatar_uri: created.avatar_uri ?? undefined,
      status: created.status,
      last_login_at: created.last_login_at
        ? toISOStringSafe(created.last_login_at)
        : undefined,
      created_at: toISOStringSafe(created.created_at),
      updated_at: toISOStringSafe(created.updated_at),
      deleted_at: created.deleted_at
        ? toISOStringSafe(created.deleted_at)
        : undefined,
    },
  };
}
