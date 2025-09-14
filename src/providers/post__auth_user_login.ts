import jwt from "jsonwebtoken";
import { MyGlobal } from "../MyGlobal";
import typia, { tags } from "typia";
import { Prisma } from "@prisma/client";
import { v4 } from "uuid";
import { toISOStringSafe } from "../util/toISOStringSafe";
import { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Authenticate a todo_list_user and issue new session tokens.
 *
 * Authenticates a registered Todo List user by verifying submitted email and
 * password credentials against the todo_list_user table. On successful
 * authentication, this issues JWT access and refresh tokens for 'user' role
 * session management. Response never leaks any credential details.
 *
 * @param props - Input props
 * @param props.body - User login data ({ email, password })
 * @returns Authorized session object containing user id and access tokens.
 * @throws {Error} If credentials are invalid (wrong email or password).
 */
export async function post__auth_user_login(props: {
  body: ITodoListUser.ILogin;
}): Promise<ITodoListUser.IAuthorized> {
  const { email, password } = props.body;
  // STEP 1: Look up user by email (case-sensitive)
  const user = await MyGlobal.prisma.todo_list_user.findUnique({
    where: { email },
  });
  if (!user) {
    throw new Error("Invalid credentials");
  }
  // STEP 2: Verify password strictly
  const isValid = await MyGlobal.password.verify(password, user.password_hash);
  if (!isValid) {
    throw new Error("Invalid credentials");
  }
  // STEP 3: JWT token construction
  const accessMaxAge = 60 * 60; // 1 hour in seconds
  const refreshMaxAge = 60 * 60 * 24 * 7; // 7 days in seconds
  const now = Date.now();
  // Compute expiration dates with string & tags.Format<'date-time'> via toISOStringSafe
  const expired_at: string & tags.Format<"date-time"> = toISOStringSafe(
    new Date(now + accessMaxAge * 1000),
  );
  const refreshable_until: string & tags.Format<"date-time"> = toISOStringSafe(
    new Date(now + refreshMaxAge * 1000),
  );
  // Construct JWT payload: only id and type, strictly by contract
  const payload = { id: user.id, type: "user" };
  const access = jwt.sign(payload, MyGlobal.env.JWT_SECRET_KEY, {
    expiresIn: accessMaxAge,
    issuer: "autobe",
  });
  const refresh = jwt.sign(
    { ...payload, tokenType: "refresh" },
    MyGlobal.env.JWT_SECRET_KEY,
    {
      expiresIn: refreshMaxAge,
      issuer: "autobe",
    },
  );
  // Assemble response conforming to ITodoListUser.IAuthorized, all fields present
  return {
    id: user.id,
    token: {
      access,
      refresh,
      expired_at,
      refreshable_until,
    },
  };
}
