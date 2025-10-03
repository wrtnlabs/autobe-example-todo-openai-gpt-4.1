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
import { AdminPayload } from "../decorators/payload/AdminPayload";

export async function patchTodoListAdminTodos(props: {
  admin: AdminPayload;
  body: ITodoListTodo.IRequest;
}): Promise<IPageITodoListTodo.ISummary> {
  const { body } = props;
  const page = body.page !== undefined ? body.page : 1;
  const limit = body.limit !== undefined ? body.limit : 20;
  const skip = (page - 1) * limit;

  const where = {
    deleted_at: null,
    ...(body.is_completed !== undefined && { is_completed: body.is_completed }),
    ...(body.search !== undefined &&
      body.search !== "" && { title: { contains: body.search } }),
  };

  const [rows, total] = await Promise.all([
    MyGlobal.prisma.todo_list_todos.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    }),
    MyGlobal.prisma.todo_list_todos.count({ where }),
  ]);

  const data = rows.map((todo) => ({
    id: todo.id,
    title: todo.title,
    is_completed: todo.is_completed,
    created_at: toISOStringSafe(todo.created_at),
    updated_at: toISOStringSafe(todo.updated_at),
  }));

  return {
    pagination: {
      current: Number(page),
      limit: Number(limit),
      records: total,
      pages: Math.ceil(total / limit),
    },
    data,
  };
}
