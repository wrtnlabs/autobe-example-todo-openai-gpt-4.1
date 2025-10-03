import { ForbiddenException } from "@nestjs/common";

import { MyGlobal } from "../../MyGlobal";
import { jwtAuthorize } from "./jwtAuthorize";
import { AdminPayload } from "../../decorators/payload/AdminPayload";

/**
 * Authenticate and authorize an administrator based on JWT and DB presence.
 *
 * @param request - Express HTTP request containing headers
 * @returns AdminPayload if authentication and authorization are valid
 * @throws ForbiddenException if not an admin or not enrolled
 */
export async function adminAuthorize(request: {
  headers: {
    authorization?: string;
  };
}): Promise<AdminPayload> {
  const payload: AdminPayload = jwtAuthorize({ request }) as AdminPayload;

  if (payload.type !== "admin") {
    throw new ForbiddenException(`You're not ${payload.type}`);
  }

  // Validate admin existence - admin is standalone (id = payload.id)
  const admin = await MyGlobal.prisma.todo_list_admins.findFirst({
    where: {
      id: payload.id,
    },
  });
  if (admin === null) {
    throw new ForbiddenException("You're not enrolled");
  }

  return payload;
}
