import { HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import typia, { tags } from "typia";
import { v4 } from "uuid";
import { MyGlobal } from "../MyGlobal";
import { PasswordUtil } from "../utils/PasswordUtil";
import { toISOStringSafe } from "../utils/toISOStringSafe";

import { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import { IPageITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListTodo";
import { IPage } from "@ORGANIZATION/PROJECT-api/lib/structures/IPage";
import { UserPayload } from "../decorators/payload/UserPayload";

export async function patchTodoListUserTodos(props: {
  user: UserPayload;
  body: ITodoListTodo.IRequest;
}): Promise<IPageITodoListTodo.ISummary> {
  const { user, body } = props;
  const page = body.page !== undefined ? body.page : 1;
  const limit = body.limit !== undefined ? body.limit : 20;
  const skip = (Number(page) - 1) * Number(limit);

  const where = {
    todo_list_user_id: user.id,
    deleted_at: null,
    ...(body.is_completed !== undefined && { is_completed: body.is_completed }),
    ...(body.search !== undefined &&
      body.search.length > 0 && {
        title: { contains: body.search },
      }),
  };

  const [rows, total] = await Promise.all([
    MyGlobal.prisma.todo_list_todos.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: Number(skip),
      take: Number(limit),
      select: {
        id: true,
        title: true,
        is_completed: true,
        created_at: true,
        updated_at: true,
      },
    }),
    MyGlobal.prisma.todo_list_todos.count({ where }),
  ]);

  const data = rows.map((row) => ({
    id: row.id,
    title: row.title,
    is_completed: row.is_completed,
    created_at: toISOStringSafe(row.created_at),
    updated_at: toISOStringSafe(row.updated_at),
  }));

  return {
    pagination: {
      current: Number(page),
      limit: Number(limit),
      records: total,
      pages: Math.ceil(total / Number(limit)),
    },
    data,
  };
}
