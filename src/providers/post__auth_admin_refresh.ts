import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";

/**
 * Refresh admin JWT session tokens using valid refresh token (todo_list_admin).
 *
 * This API operation allows authenticated admins to refresh their access and
 * refresh JWT tokens using a valid, non-expired refresh token. The admin is
 * identified from the refresh token's payload, then looked up in the
 * 'todo_list_admin' table. If successful, a new access and refresh token pair
 * is issued with renewal of expiration timestamps.
 *
 * The function enforces session continuity policies by cryptographically
 * verifying the refresh token, checking admin existence, and using only
 * schema-approved fields in responses. Expired or tampered tokens result in
 * business errors; at no point are passwords or sensitive fields accessible.
 *
 * @param props - Object containing the refresh token in body
 * @param props.body - Request body containing { refresh_token } as required by
 *   ITodoListAdmin.IRefresh
 * @returns ITodoListAdmin.IAuthorized - Admin id and JWT authorization token
 *   structure (access/refresh/expired)
 * @throws {Error} If the refresh token cannot be verified, has an invalid
 *   payload, or no matching admin exists.
 */
export async function post__auth_admin_refresh(props: {
  body: ITodoListAdmin.IRefresh;
}): Promise<ITodoListAdmin.IAuthorized> {
  const { refresh_token } = props.body;
  // Step 1: Verify and decode
  let decoded: { id?: string; type?: string };
  try {
    decoded = jwt.verify(refresh_token, MyGlobal.env.JWT_SECRET_KEY, {
      issuer: "autobe",
    }) as { id?: string; type?: string };
  } catch {
    throw new Error("Invalid or expired refresh token");
  }
  // Step 2: Extract identity and check claim
  if (!decoded.id || decoded.type !== "admin") {
    throw new Error("Malformed refresh token payload");
  }
  // Step 3: Confirm admin exists
  const admin = await MyGlobal.prisma.todo_list_admin.findUnique({
    where: { id: decoded.id },
  });
  if (!admin) throw new Error("Admin account not found");
  // Step 4: Prepare token and expiry times (no Date types!)
  const now = Date.now();
  const accessExpire: string & tags.Format<"date-time"> = toISOStringSafe(
    new Date(now + 60 * 60 * 1000),
  );
  const refreshExpire: string & tags.Format<"date-time"> = toISOStringSafe(
    new Date(now + 7 * 24 * 60 * 60 * 1000),
  );
  // Step 5: Build payload/issue JWTs
  const payload = { id: admin.id, type: "admin" };
  const accessToken = jwt.sign(payload, MyGlobal.env.JWT_SECRET_KEY, {
    expiresIn: "1h",
    issuer: "autobe",
  });
  const refreshToken = jwt.sign(payload, MyGlobal.env.JWT_SECRET_KEY, {
    expiresIn: "7d",
    issuer: "autobe",
  });
  // Step 6: Build response (no Date types anywhere)
  return {
    id: admin.id,
    token: {
      access: accessToken,
      refresh: refreshToken,
      expired_at: accessExpire,
      refreshable_until: refreshExpire,
    },
  };
}
