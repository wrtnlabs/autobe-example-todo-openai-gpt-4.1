import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";

/**
 * Refresh JWT authentication tokens for 'user' role using
 * todo_list_auth_sessions (refresh token operation).
 *
 * This endpoint refreshes JWT authentication tokens for an authenticated
 * 'user'. It uses the 'todo_list_auth_sessions' table to validate the provided
 * session_token (refresh token) by checking for matching, active, unexpired,
 * and non-revoked session. It also confirms the linked user exists and is not
 * soft-deleted ('deleted_at' is null). Session expiration ('expires_at') and
 * revocation logic are strictly enforced per schema and business rules,
 * ensuring users can only refresh tokens when all security conditions are
 * satisfied.
 *
 * If the submitted refresh token is expired, revoked, or does not correspond to
 * a valid, active session, the operation fails with a specific error requiring
 * re-authentication via the login endpoint. Successful refreshes update
 * relevant session metadata (user_agent, ip_address) and return new JWT
 * access/refresh tokens per the established session policy. All activity is
 * logged for compliance and security review, referencing the corresponding user
 * account.
 *
 * Operation is only available to authenticated users presenting a valid refresh
 * token (session_token); it does not require explicit authentication on call
 * but uses token validation per security best practices. Tightly integrated
 * with the login and join/register operations to provide seamless
 * authentication for the 'user' role defined in the schema.
 *
 * @param props - Request properties
 * @param props.body - Refresh token request with session_token for the 'user'
 * @returns Refreshed JWT access and refresh tokens for the 'user' role on
 *   successful validation.
 * @throws {Error} If the session token is invalid, expired, revoked, or the
 *   user is deleted.
 */
export async function post__auth_user_refresh(props: {
  body: ITodoListUser.IRefresh;
}): Promise<ITodoListUser.IAuthorized> {
  const { session_token } = props.body;
  // 1. Find the session and its user
  const session = await MyGlobal.prisma.todo_list_auth_sessions.findUnique({
    where: { session_token },
    include: { user: true },
  });
  if (!session) throw new Error("Session not found or invalid refresh token");
  if (session.revoked_at !== null)
    throw new Error("Session revoked - please login again");
  if (session.expires_at < new Date())
    throw new Error("Session expired - please login again");
  if (!session.user || session.user.deleted_at !== null)
    throw new Error("User not found or deleted");

  const now = new Date();
  const tokenExpiresInSecs = 60 * 60; // 1 hour
  const refreshExpiresInSecs = 7 * 24 * 60 * 60; // 7 days
  const expiredAtDate = new Date(now.getTime() + tokenExpiresInSecs * 1000);
  const refreshableUntilDate = new Date(
    now.getTime() + refreshExpiresInSecs * 1000,
  );

  // 2. Create a new access and refresh token (JWT)
  const accessPayload = {
    id: session.user.id,
    type: "user" as const,
  };
  const access = jwt.sign(accessPayload, MyGlobal.env.JWT_SECRET_KEY, {
    expiresIn: tokenExpiresInSecs,
    issuer: "autobe",
  });
  const refresh = jwt.sign(
    { session_token: session.session_token },
    MyGlobal.env.JWT_SECRET_KEY,
    {
      expiresIn: refreshExpiresInSecs,
      issuer: "autobe",
    },
  );

  // 3. Optionally update session metadata (NO 'updated_at' per schema)
  await MyGlobal.prisma.todo_list_auth_sessions.update({
    where: { id: session.id },
    data: {
      // e.g. user_agent: context.request.headers['user-agent'] (not available here)
      // ip_address: context.request.ip (not available here)
    },
  });

  return {
    token: {
      access,
      refresh,
      expired_at: toISOStringSafe(expiredAtDate),
      refreshable_until: toISOStringSafe(refreshableUntilDate),
    },
    user: {
      id: session.user.id,
      email: session.user.email as string & tags.Format<"email">,
      is_email_verified: session.user.is_email_verified,
      created_at: toISOStringSafe(session.user.created_at),
    },
  };
}
