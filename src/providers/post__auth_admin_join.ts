import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";

/**
 * Register a new admin account (todo_list_admin table).
 *
 * This endpoint enables system administrators to register a new admin account
 * in the Todo List application. The operation requires a unique email and plain
 * text password. The password is securely hashed before storage using the
 * system's password hashing utility. Unique constraint is enforced on admin
 * emails, and created_at/updated_at timestamps are set to current time. JWT
 * access and refresh tokens are issued on success.
 *
 * No authentication is required to call this endpoint, but registration should
 * be restricted in production deployments to avoid privilege escalation.
 *
 * @param props - Request properties
 * @param props.body - The registration information (email and password)
 * @returns The newly created admin's id and authorization token structure.
 * @throws {Error} If email is already registered, or registration fails.
 */
export async function post__auth_admin_join(props: {
  body: ITodoListAdmin.ICreate;
}): Promise<ITodoListAdmin.IAuthorized> {
  const { email, password } = props.body;

  // Check for duplicate email (enforce unique)
  const existing = await MyGlobal.prisma.todo_list_admin.findFirst({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    throw new Error("Email already registered");
  }

  // Generate business fields
  const id = v4() as string & tags.Format<"uuid">;
  const now = toISOStringSafe(new Date());
  const password_hash = await MyGlobal.password.hash(password);

  // Create admin
  const created = await MyGlobal.prisma.todo_list_admin.create({
    data: {
      id,
      email,
      password_hash,
      created_at: now,
      updated_at: now,
    },
  });

  // Compute token expiries (business arithmetic in milliseconds, then ISO string conversion)
  const accessExpMs = Date.now() + 60 * 60 * 1000; // 1 hour
  const refreshExpMs = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

  // Issue JWTs (payload structure: { id, type: 'admin' })
  const accessToken = jwt.sign(
    { id: created.id, type: "admin" },
    MyGlobal.env.JWT_SECRET_KEY,
    { expiresIn: "1h", issuer: "autobe" },
  );
  const refreshToken = jwt.sign(
    { id: created.id, type: "admin" },
    MyGlobal.env.JWT_SECRET_KEY,
    { expiresIn: "7d", issuer: "autobe" },
  );

  return {
    id: created.id,
    token: {
      access: accessToken,
      refresh: refreshToken,
      expired_at: toISOStringSafe(new Date(accessExpMs)),
      refreshable_until: toISOStringSafe(new Date(refreshExpMs)),
    },
  };
}
