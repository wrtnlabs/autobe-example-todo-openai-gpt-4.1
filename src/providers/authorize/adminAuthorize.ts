import { ForbiddenException } from "@nestjs/common";

import { MyGlobal } from "../../MyGlobal";
import { jwtAuthorize } from "./jwtAuthorize";
import { AdminPayload } from "../../decorators/payload/AdminPayload";

/**
 * Authenticates and authorizes an admin user via JWT.
 * Ensures the payload matches the `admin` type and the account exists.
 *
 * @param request Express HTTP request containing Authorization header
 * @throws ForbiddenException if not admin or unenrolled
 * @returns AdminPayload after successful verification
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

  // As admin table is standalone, JWT id is admin's id.
  const admin = await MyGlobal.prisma.todo_list_admin.findFirst({
    where: {
      id: payload.id,
    },
  });

  if (admin === null) {
    throw new ForbiddenException("You're not enrolled");
  }

  return payload;
}
