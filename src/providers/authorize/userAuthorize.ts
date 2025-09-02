import { ForbiddenException } from "@nestjs/common";

import { MyGlobal } from "../../MyGlobal";
import { jwtAuthorize } from "./jwtAuthorize";
import { UserPayload } from "../../decorators/payload/UserPayload";

/**
 * Authenticates and authorizes a standard registered user based on JWT token.
 * - Verifies token
 * - Checks role type
 * - Ensures user exists and is active (not soft-deleted)
 *
 * @param request HTTP request with Authorization header
 * @returns UserPayload with ID and type
 * @throws ForbiddenException if not matching user role or not found
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

  // User existence validation: soft-deleted (deleted_at != null) users cannot authenticate
  const user = await MyGlobal.prisma.todo_list_users.findFirst({
    where: {
      id: payload.id,
      deleted_at: null
    },
  });

  if (!user) {
    throw new ForbiddenException("You're not enrolled");
  }

  return payload;
}
