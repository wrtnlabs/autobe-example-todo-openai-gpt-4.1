import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Refresh JWT tokens for a todo_list_user session.
 *
 * This token refresh endpoint provides authenticated Todo List users a means to
 * renew their session by presenting a valid refresh token issued during
 * previous login or registration. It validates the refresh token, confirms its
 * association with an existing todo_list_user, and, if valid and unexpired,
 * issues a new set of access and refresh tokens for seamless session
 * continuation.
 *
 * Token logic is implemented per security and session policy: access tokens are
 * short-lived (30 minutes), while refresh tokens may be valid up to 30 days,
 * conforming to the requirements in the business documentation and permission
 * matrix.
 *
 * The token refresh process is stateless regarding the underlying
 * todo_list_user schema; it does not alter, create, or remove table records. It
 * simply reads and verifies minimal identifying fields linked to the user's
 * identity. No sensitive info is returned.
 *
 * Security and session enforcement is maintained: expired, invalid, or tampered
 * tokens result in error responses and session invalidation, supporting robust
 * access control.
 *
 * This operation is required to maintain authenticated user workflows,
 * supporting login and join (registration) as the main entry points for session
 * initialization.
 *
 * @param props - Object containing the refresh token for session renewal.
 * @param props.body - The refresh token provided by the user for session
 *   continuation.
 * @returns The refreshed session credentials, including new access and refresh
 *   tokens with updated expiry times.
 * @throws {Error} If the refresh token is invalid, expired, malformed, or if
 *   the user account is not found.
 */
export async function post__auth_user_refresh(props: {
  body: ITodoListUser.IRefresh;
}): Promise<ITodoListUser.IAuthorized> {
  const { body } = props;

  let payload: { id: string; type: string };
  try {
    payload = jwt.verify(body.refresh_token, MyGlobal.env.JWT_SECRET_KEY, {
      issuer: "autobe",
    }) as { id: string; type: string };
  } catch {
    throw new Error("Invalid or expired refresh token");
  }
  // Validate payload structure explicitly
  if (
    typeof payload !== "object" ||
    payload == null ||
    typeof payload.id !== "string" ||
    payload.type !== "user"
  ) {
    throw new Error("Malformed refresh token payload");
  }

  const user = await MyGlobal.prisma.todo_list_user.findUnique({
    where: { id: payload.id },
  });
  if (!user) {
    throw new Error("User not found for provided refresh token");
  }

  const now = Date.now();
  const accessExpSec = 30 * 60; // 30 minutes
  const refreshExpSec = 30 * 24 * 60 * 60; // 30 days
  const accessExp = now + accessExpSec * 1000;
  const refreshExp = now + refreshExpSec * 1000;

  const accessToken = jwt.sign(
    { id: user.id, type: "user" },
    MyGlobal.env.JWT_SECRET_KEY,
    {
      expiresIn: accessExpSec,
      issuer: "autobe",
    },
  );
  const refreshToken = jwt.sign(
    { id: user.id, type: "user" },
    MyGlobal.env.JWT_SECRET_KEY,
    {
      expiresIn: refreshExpSec,
      issuer: "autobe",
    },
  );

  return {
    id: user.id,
    token: {
      access: accessToken,
      refresh: refreshToken,
      expired_at: toISOStringSafe(new Date(accessExp)),
      refreshable_until: toISOStringSafe(new Date(refreshExp)),
    },
  };
}
