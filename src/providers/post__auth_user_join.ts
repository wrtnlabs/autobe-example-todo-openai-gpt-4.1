import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Register a new todo_list_user account and issue authentication tokens.
 *
 * This registration endpoint allows users to sign up for the Todo List
 * application by providing a unique email address and password. The operation
 * creates a new account in the todo_list_user table, ensuring the email is
 * unique and the password is securely hashed. On success, JWT authentication
 * and refresh tokens are returned per requirements.
 *
 * Security best practices:
 *
 * - Passwords are always hashed before storage using MyGlobal.password.hash.
 * - Duplicate email registration is rejected. No information about account
 *   existence is leaked.
 * - All date fields are handled as string & tags.Format<'date-time'>, never using
 *   the Date type.
 * - Only fields present in the schema (id, email, password_hash, created_at,
 *   updated_at) are used or stored.
 *
 * @param props - The registration request containing user's email and password.
 * @returns The authorized session info containing the new user's id and
 *   authentication tokens.
 * @throws {Error} If registration fails due to duplicate email or any internal
 *   error.
 */
export async function post__auth_user_join(props: {
  body: ITodoListUser.IJoin;
}): Promise<ITodoListUser.IAuthorized> {
  const { body } = props;
  const now: string & tags.Format<"date-time"> = toISOStringSafe(new Date());
  const id: string & tags.Format<"uuid"> = v4();
  const email: string = body.email.toLowerCase();
  const password_hash: string = await MyGlobal.password.hash(body.password);

  try {
    await MyGlobal.prisma.todo_list_user.create({
      data: {
        id,
        email,
        password_hash,
        created_at: now,
        updated_at: now,
      },
    });
  } catch (err) {
    // Unique constraint violation, generic error for registration failure (email in use or internal)
    throw new Error(
      "Registration failed: Email may already be registered or internal error.",
    );
  }

  const JWT_EXPIRES_SEC = 60 * 60; // 1 hour
  const JWT_REFRESH_SEC = 60 * 60 * 24 * 7; // 7 days
  const nowEpoch = Date.now();
  const expired_at: string & tags.Format<"date-time"> = toISOStringSafe(
    new Date(nowEpoch + JWT_EXPIRES_SEC * 1000),
  );
  const refreshable_until: string & tags.Format<"date-time"> = toISOStringSafe(
    new Date(nowEpoch + JWT_REFRESH_SEC * 1000),
  );

  const access: string = jwt.sign(
    { id, type: "user" },
    MyGlobal.env.JWT_SECRET_KEY,
    { expiresIn: JWT_EXPIRES_SEC, issuer: "autobe" },
  );
  const refresh: string = jwt.sign(
    { id, type: "user", tokenType: "refresh" },
    MyGlobal.env.JWT_SECRET_KEY,
    { expiresIn: JWT_REFRESH_SEC, issuer: "autobe" },
  );

  return {
    id,
    token: {
      access,
      refresh,
      expired_at,
      refreshable_until,
    },
  };
}
