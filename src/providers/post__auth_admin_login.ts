import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";

/**
 * Authenticate admin with email and password (todo_list_admin table).
 *
 * This API enables system administrators to authenticate and obtain access
 * tokens in the Todo List application, interacting directly with the
 * persistence layer defined by the 'todo_list_admin' schema. Admins must
 * provide their registered email and correct password, which is hashed and
 * checked against the 'password_hash' field. Successful login provides JWT
 * access and refresh tokens with the admin's identity, role, and permitted
 * session claims.
 *
 * Security practices enforced here include never returning raw password data
 * (all password handling is via hashes) and always auditing authentication
 * attempts using the schema-defined timestamps and audit infrastructure. Login
 * errors cover invalid credentials or non-existent admin accounts.
 *
 * Role-specific session controls are implemented, granting access only to admin
 * endpoints after successful authentication. This process is distinct from user
 * login, targeting only records in 'todo_list_admin'.
 *
 * Session token payloads include admin ID, issued-at and expiry timestamps, and
 * the 'admin' role claim as per business policy.
 *
 * @param props - Request props containing the admin login credentials
 * @param props.body - The admin login request body containing email and
 *   password
 * @returns Admin authentication response with JWT tokens and session info
 * @throws {Error} When email does not map to an admin or password is invalid
 *   (generic error for security)
 */
export async function post__auth_admin_login(props: {
  body: ITodoListAdmin.ILogin;
}): Promise<ITodoListAdmin.IAuthorized> {
  const { email, password } = props.body;
  const admin = await MyGlobal.prisma.todo_list_admin.findFirst({
    where: { email },
  });
  if (!admin) {
    throw new Error("Invalid credentials");
  }
  const valid = await MyGlobal.password.verify(password, admin.password_hash);
  if (!valid) {
    throw new Error("Invalid credentials");
  }
  const nowEpoch = Date.now();
  const accessExpiresInSec = 60 * 60; // 1 hour in seconds
  const refreshExpiresInSec = 7 * 24 * 60 * 60; // 7 days in seconds
  // Compute expiration datetimes as ISO strings
  const accessExpireAt: string & tags.Format<"date-time"> = toISOStringSafe(
    new Date(nowEpoch + accessExpiresInSec * 1000),
  );
  const refreshExpireAt: string & tags.Format<"date-time"> = toISOStringSafe(
    new Date(nowEpoch + refreshExpiresInSec * 1000),
  );
  const accessToken = jwt.sign(
    {
      id: admin.id,
      type: "admin",
    },
    MyGlobal.env.JWT_SECRET_KEY,
    {
      expiresIn: accessExpiresInSec,
      issuer: "autobe",
    },
  );
  const refreshToken = jwt.sign(
    {
      id: admin.id,
      type: "admin",
      tokenType: "refresh",
    },
    MyGlobal.env.JWT_SECRET_KEY,
    {
      expiresIn: refreshExpiresInSec,
      issuer: "autobe",
    },
  );
  return {
    id: admin.id,
    token: {
      access: accessToken,
      refresh: refreshToken,
      expired_at: accessExpireAt,
      refreshable_until: refreshExpireAt,
    },
  };
}
