import { HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import typia, { tags } from "typia";
import { v4 } from "uuid";
import { MyGlobal } from "../MyGlobal";
import { PasswordUtil } from "../utils/PasswordUtil";
import { toISOStringSafe } from "../utils/toISOStringSafe";

import { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import { AdminPayload } from "../decorators/payload/AdminPayload";

export async function putTodoListAdminUsersUserId(props: {
  admin: AdminPayload;
  userId: string & tags.Format<"uuid">;
  body: ITodoListUser.IUpdate;
}): Promise<ITodoListUser> {
  const user = await MyGlobal.prisma.todo_list_users.findUnique({
    where: { id: props.userId },
  });
  if (!user) {
    throw new HttpException("User not found", 404);
  }

  // Prepare updated fields. Only include provided fields (email, password_hash).
  const now = toISOStringSafe(new Date());
  const updateFields: {
    email?: string;
    password_hash?: string;
    updated_at: string & tags.Format<"date-time">;
  } = {
    ...(props.body.email !== undefined ? { email: props.body.email } : {}),
    ...(props.body.password_hash !== undefined
      ? { password_hash: props.body.password_hash }
      : {}),
    updated_at: now,
  };

  try {
    const updated = await MyGlobal.prisma.todo_list_users.update({
      where: { id: props.userId },
      data: updateFields,
    });
    return {
      id: updated.id,
      email: updated.email,
      created_at: toISOStringSafe(updated.created_at),
      updated_at: toISOStringSafe(updated.updated_at),
    };
  } catch (error) {
    // Check unique constraint violation (duplicate email)
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw new HttpException("Email must be unique", 409);
    }
    throw new HttpException("Internal Server Error", 500);
  }
}
