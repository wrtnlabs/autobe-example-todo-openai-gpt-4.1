import { ForbiddenException } from "@nestjs/common";

import { MyGlobal } from "../../MyGlobal";
import { jwtAuthorize } from "./jwtAuthorize";
import { AdminPayload } from "../../decorators/payload/AdminPayload";

/**
 * Authenticate and authorize admin accounts via JWT.
 *
 * Verifies JWT tokens for admin role, checks token payload validity, and ensures
 * the corresponding admin exists and is not soft-deleted or disabled.
 *
 * @param request HTTP request object containing authorization header
 * @returns Authenticated AdminPayload
 * @throws ForbiddenException if not admin or not enrolled/active
 */
export async function adminAuthorize(request: {
  headers: {
    authorization?: string;
  };
}): Promise<AdminPayload> {
  // Extract and verify the JWT for admin role
  const payload: AdminPayload = jwtAuthorize({ request }) as AdminPayload;

  if (payload.type !== "admin") {
    throw new ForbiddenException(`You're not ${payload.type}`);
  }

  // Validate admin existence and status (using top-level admin id)
  const admin = await MyGlobal.prisma.todo_list_admins.findFirst({
    where: {
      id: payload.id,
      deleted_at: null,
      status: "active"
    },
  });

  if (admin === null) {
    throw new ForbiddenException("You're not enrolled or not active");
  }

  return payload;
}
