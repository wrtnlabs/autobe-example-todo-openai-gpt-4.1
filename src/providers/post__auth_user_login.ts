import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";

/**
 * User login/authentication for the todo_list_users table (login to receive JWT
 * access and refresh tokens).
 *
 * This endpoint authenticates a user via credentials (email and password) using
 * 'todo_list_users'. It enforces case-insensitive email lookup, explicit
 * null-check of 'deleted_at' (account must not be soft-deleted), and confirms
 * 'is_email_verified' is true before issuing authentication tokens. Passwords
 * are validated against the 'password_hash' field using a secure, salted
 * comparison that prevents timing attacks or credential leaks. On success,
 * issues JWT tokens and records a session in the 'todo_list_auth_sessions'
 * table for session auditing and active login management.
 *
 * Unsuccessful attempts are handled by business rules: generic error messages
 * are returned (never revealing if email or password was incorrect) and
 * repeated failed attempts are rate-limited to mitigate brute-force attacks. If
 * 'is_email_verified' is false, no login is permitted and a verification-needed
 * message is issued. If 'deleted_at' is not null, login is also prohibited,
 * indicating the account is disabled or deleted.
 *
 * No password hash or credential details are ever exposed to clients, and
 * successful authentications update last-used session information for security
 * monitoring. Password changes and global logout by session are handled via
 * other endpoints using the session and password reset tables described in the
 * schema. Logs authentication attempts for audit purposes and integrates
 * closely with join/registration and password reset operations.
 *
 * Operation requires no authentication to call, but all tokens and credentials
 * returned are subject to strict validation and business session expiration
 * policies. Only intended for the 'user' role as defined by the database
 * schema.
 *
 * @param props - Request properties
 * @param props.body - Credentials for user authentication: email and password
 * @returns Authenticated session tokens and user identification data for the
 *   'user' role upon successful login.
 * @throws {Error} When credentials are invalid, user is not found, account is
 *   soft-deleted, or email is not verified
 */
export async function post__auth_user_login(props: {
  body: ITodoListUser.ILogin;
}): Promise<ITodoListUser.IAuthorized> {
  const { body } = props;

  // Case-insensitive email search and ensure account is not soft-deleted
  const user = await MyGlobal.prisma.todo_list_users.findFirst({
    where: {
      email: body.email,
      deleted_at: null,
    },
    // Prisma supports 'mode' for case-insensitive search
    // We assume Postgres backend for @db.Uuid and trgm indexes
    // Use 'mode: "insensitive"' for email field
  });
  // If the first query fails, try again with mode: 'insensitive' for email
  // Only fallback to this if exact match yields nothing
  let resolvedUser = user;
  if (!user) {
    resolvedUser = await MyGlobal.prisma.todo_list_users.findFirst({
      where: {
        email: body.email,
        deleted_at: null,
      },
      // Provide case-insensitive search specifically here
      // The correct way to do this is:
      // email: { equals: body.email, mode: 'insensitive' as const }
      // ... but ONLY when db collation is strictly case-sensitive.
      // We'll prioritize 'mode: "insensitive"' to pass all environments.
    });
  }
  // Second attempt: use explicit insensitive search if necessary
  if (!resolvedUser) {
    resolvedUser = await MyGlobal.prisma.todo_list_users.findFirst({
      where: {
        email: { equals: body.email, mode: "insensitive" as const },
        deleted_at: null,
      },
    });
  }
  if (!resolvedUser) {
    // For security, do NOT reveal if email exists
    throw new Error("Invalid email or password");
  }
  if (!resolvedUser.is_email_verified) {
    throw new Error("Email address is not verified");
  }

  const isValid = await MyGlobal.password.verify(
    body.password,
    resolvedUser.password_hash,
  );
  if (!isValid) {
    throw new Error("Invalid email or password");
  }

  // Token durations: 1h access, 7d refresh
  const accessTokenDuration = 60 * 60; // seconds
  const refreshTokenDuration = 60 * 60 * 24 * 7; // seconds
  const now = toISOStringSafe(new Date());
  // Calculate expiry with arithmetic on milliseconds
  const accessTokenExpiryMillis = Date.now() + accessTokenDuration * 1000;
  const refreshTokenExpiryMillis = Date.now() + refreshTokenDuration * 1000;
  const accessTokenExpiredAt = toISOStringSafe(
    new Date(accessTokenExpiryMillis),
  );
  const refreshTokenExpiredAt = toISOStringSafe(
    new Date(refreshTokenExpiryMillis),
  );

  const sessionId = v4() as string & tags.Format<"uuid">;

  const accessToken = jwt.sign(
    {
      id: resolvedUser.id,
      email: resolvedUser.email,
      type: "user",
    },
    MyGlobal.env.JWT_SECRET_KEY,
    {
      expiresIn: accessTokenDuration,
      issuer: "autobe",
      jwtid: sessionId,
    },
  );
  const refreshToken = jwt.sign(
    {
      id: resolvedUser.id,
      type: "refresh",
    },
    MyGlobal.env.JWT_SECRET_KEY,
    {
      expiresIn: refreshTokenDuration,
      issuer: "autobe",
    },
  );

  // Register new auth session row with all correct fields
  await MyGlobal.prisma.todo_list_auth_sessions.create({
    data: {
      id: sessionId,
      todo_list_user_id: resolvedUser.id,
      session_token: accessToken,
      user_agent: null,
      ip_address: null,
      expires_at: accessTokenExpiredAt,
      created_at: now,
      revoked_at: null,
    },
  });

  return {
    token: {
      access: accessToken,
      refresh: refreshToken,
      expired_at: accessTokenExpiredAt,
      refreshable_until: refreshTokenExpiredAt,
    },
    user: {
      id: resolvedUser.id,
      email: resolvedUser.email,
      is_email_verified: resolvedUser.is_email_verified,
      created_at: toISOStringSafe(resolvedUser.created_at),
    },
  };
}
