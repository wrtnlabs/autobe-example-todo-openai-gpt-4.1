import { ForbiddenException } from "@nestjs/common";

import { MyGlobal } from "../../MyGlobal";
import { jwtAuthorize } from "./jwtAuthorize";
import { UserPayload } from "../../decorators/payload/UserPayload";

/**
 * Authenticate and authorize a regular user account via JWT.
 *
 * @param request - Incoming HTTP request object
 * @returns The decoded UserPayload if JWT and database checks pass
 * @throws ForbiddenException if role/type mismatch or user does not exist
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

  // Check if the user exists in the database
  const user = await MyGlobal.prisma.todo_list_users.findFirst({
    where: {
      id: payload.id,
    },
  });

  if (user === null) {
    throw new ForbiddenException("You're not enrolled");
  }

  return payload;
}
