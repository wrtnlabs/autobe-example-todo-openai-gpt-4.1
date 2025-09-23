import { ForbiddenException } from "@nestjs/common";

import { MyGlobal } from "../../MyGlobal";
import { jwtAuthorize } from "./jwtAuthorize";
import { UserPayload } from "../../decorators/payload/UserPayload";

/**
 * Authorize function for users. Validates JWT, checks 'user' type, and ensures the user exists and is not deleted or disabled.
 *
 * @param request Incoming HTTP request with headers
 * @returns Authenticated user's payload
 * @throws ForbiddenException if user is not authenticated, not a 'user', deleted, or status is not 'active'.
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

  // payload.id refers to todo_list_users.id (top-level user ID)
  const user = await MyGlobal.prisma.todo_list_users.findFirst({
    where: {
      id: payload.id,
      deleted_at: null,
      status: "active"
    },
  });

  if (user === null) {
    throw new ForbiddenException("You're not enrolled");
  }

  return payload;
}
