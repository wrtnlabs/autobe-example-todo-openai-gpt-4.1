import { ForbiddenException } from "@nestjs/common";

import { MyGlobal } from "../../MyGlobal";
import { jwtAuthorize } from "./jwtAuthorize";
import { UserPayload } from "../../decorators/payload/UserPayload";

/**
 * Authenticates and authorizes a Todo List user using JWT.
 * - Verifies JWT token with role check (type === "user")
 * - Fetches todo_list_user from DB based on payload.id
 * - Only allows if user exists
 * @param request Express request with headers (containing Bearer token)
 * @returns Authenticated UserPayload
 * @throws ForbiddenException if not enrolled or role mismatched
 */
export async function userAuthorize(request: {
  headers: {
    authorization?: string;
  };
}): Promise<UserPayload> {
  const payload: UserPayload = jwtAuthorize({ request }) as UserPayload;

  if (payload.type !== "user") {
    throw new ForbiddenException(`You're not ${payload.type}`);
  }

  // Top-level user table is todo_list_user. Payload.id = todo_list_user.id.
  const user = await MyGlobal.prisma.todo_list_user.findFirst({
    where: {
      id: payload.id // Standalone table, primary key
    },
  });

  if (user === null) {
    throw new ForbiddenException("You're not enrolled");
  }

  return payload;
}
