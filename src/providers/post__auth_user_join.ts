import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";

/**
 * Register a new user account in the todo_list_users table (authentication join
 * operation) for registration and onboarding.
 *
 * This endpoint creates a new user record in the database using a unique email
 * and a securely hashed password. The email is checked for duplicates
 * (case-insensitive), and the password is never stored in plain text. Account
 * is_email_verified is set to false on creation, and timestamp fields are set
 * to the current time. JWT tokens (access and refresh) are issued upon
 * completion, with correct expiration times in ISO 8601 format. No sensitive
 * fields are returned in the response.
 *
 * @param props - Request properties
 * @param props.body - Registration information for creating a new user account
 *   (email, password)
 * @returns Authorized authentication tokens and user identification upon
 *   successful registration for the 'user' role.
 * @throws {Error} If the email address is already registered
 */
export async function post__auth_user_join(props: {
  body: ITodoListUser.IJoin;
}): Promise<ITodoListUser.IAuthorized> {
  const { email, password } = props.body;
  // Duplicate check: case-insensitive (normalize email to lower case for DB)
  const existed = await MyGlobal.prisma.todo_list_users.findFirst({
    where: { email: email.toLowerCase() },
  });
  if (existed) {
    throw new Error("Email is already registered");
  }

  const id = v4() as string & tags.Format<"uuid">;
  const password_hash = await MyGlobal.password.hash(password);
  const now = toISOStringSafe(new Date());
  const created = await MyGlobal.prisma.todo_list_users.create({
    data: {
      id,
      email: email.toLowerCase(),
      password_hash,
      is_email_verified: false,
      created_at: now,
      updated_at: now,
    },
  });

  // JWT token creation using auto-injected 'jwt' import, not MyGlobal.jwt
  const access = jwt.sign(
    {
      id: created.id,
      type: "user",
    },
    MyGlobal.env.JWT_SECRET_KEY,
    { expiresIn: "1h", issuer: "autobe" },
  );
  const refresh = jwt.sign(
    {
      id: created.id,
      type: "user",
      tokenType: "refresh",
    },
    MyGlobal.env.JWT_SECRET_KEY,
    { expiresIn: "7d", issuer: "autobe" },
  );

  const expired_at = toISOStringSafe(new Date(Date.now() + 60 * 60 * 1000));
  const refreshable_until = toISOStringSafe(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  );

  return {
    token: {
      access,
      refresh,
      expired_at,
      refreshable_until,
    },
    user: {
      id: created.id,
      email: created.email,
      is_email_verified: created.is_email_verified,
      created_at: toISOStringSafe(created.created_at),
    },
  };
}
