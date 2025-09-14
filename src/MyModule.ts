import { Module } from "@nestjs/common";

import { AuthUserController } from "./controllers/auth/user/AuthUserController";
import { AuthAdminController } from "./controllers/auth/admin/AuthAdminController";
import { TodolistUserTodosController } from "./controllers/todoList/user/todos/TodolistUserTodosController";
import { TodolistAdminTodosController } from "./controllers/todoList/admin/todos/TodolistAdminTodosController";

@Module({
  controllers: [
    AuthUserController,
    AuthAdminController,
    TodolistUserTodosController,
    TodolistAdminTodosController,
  ],
})
export class MyModule {}
