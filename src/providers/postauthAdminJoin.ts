import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { HttpException } from "@nestjs/common";
import { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";

/**
 * Registers a new administrator in the todo_list_admins table.
 *
 * This endpoint allows public registration of new admin accounts. Enforces
 * unique email, hashes password, sets profile fields, and initializes status
 * and privilege level. If the email is already registered, throws a 409 error.
 * On success, issues JWT-based authorization token and returns a profile DTO as
 * per ITodoListAdmin.IAuthorized.
 *
 * @param props - Object containing registration request body matching
 *   ITodoListAdmin.IJoin (email, password_hash, etc)
 * @returns Admin authorization result (profile plus tokens)
 * @throws {HttpException} If email already registered (409 conflict) or on
 *   internal failure
 */
export async function postauthAdminJoin(props: {
  body: ITodoListAdmin.IJoin;
}): Promise<ITodoListAdmin.IAuthorized> {
  const now = toISOStringSafe(new Date());
  const id = v4();
  const {
    email,
    password_hash,
    name = undefined,
    avatar_uri = undefined,
    status = "active",
    privilege_level = "support",
  } = props.body;

  // 1. Check duplicate email (case sensitive, @@unique on email)
  const exists = await MyGlobal.prisma.todo_list_admins.findUnique({
    where: { email },
  });
  if (exists) {
    throw new HttpException(
      "Email is already registered as administrator",
      409,
    );
  }

  // 2. Hash password
  const hashedPassword = await MyGlobal.password.hash(password_hash);

  // 3. Insert new admin record
  const created = await MyGlobal.prisma.todo_list_admins.create({
    data: {
      id,
      email,
      password_hash: hashedPassword,
      name: name !== undefined ? name : undefined,
      avatar_uri: avatar_uri !== undefined ? avatar_uri : undefined,
      status,
      privilege_level,
      created_at: now,
      updated_at: now,
      // all others are nullable/non-required by schema, omitted
    },
  });

  // 4. Generate tokens (JWT access and refresh)
  const accessExpire = new Date(Date.now() + 60 * 60 * 1000); // 1h
  const refreshExpire = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7d

  const access = jwt.sign(
    { id: created.id, type: "admin" },
    MyGlobal.env.JWT_SECRET_KEY,
    { expiresIn: "1h", issuer: "autobe" },
  );
  const refresh = jwt.sign(
    { id: created.id, type: "admin" },
    MyGlobal.env.JWT_SECRET_KEY,
    { expiresIn: "7d", issuer: "autobe" },
  );

  return {
    id: created.id,
    token: {
      access,
      refresh,
      expired_at: toISOStringSafe(accessExpire),
      refreshable_until: toISOStringSafe(refreshExpire),
    },
    admin: {
      id: created.id,
      email: created.email,
      name:
        created.name !== null && created.name !== undefined
          ? created.name
          : undefined,
      avatar_uri:
        created.avatar_uri !== null && created.avatar_uri !== undefined
          ? created.avatar_uri
          : undefined,
      status: created.status,
      privilege_level: created.privilege_level,
      last_admin_action_at:
        created.last_admin_action_at !== null &&
        created.last_admin_action_at !== undefined
          ? toISOStringSafe(created.last_admin_action_at)
          : undefined,
      last_login_at:
        created.last_login_at !== null && created.last_login_at !== undefined
          ? toISOStringSafe(created.last_login_at)
          : undefined,
      created_at: toISOStringSafe(created.created_at),
      updated_at: toISOStringSafe(created.updated_at),
      deleted_at:
        created.deleted_at !== null && created.deleted_at !== undefined
          ? toISOStringSafe(created.deleted_at)
          : undefined,
    },
  };
}
