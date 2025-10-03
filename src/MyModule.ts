import { Module } from "@nestjs/common";

import { AuthUserController } from "./controllers/auth/user/AuthUserController";
import { AuthAdminController } from "./controllers/auth/admin/AuthAdminController";
import { TodolistAdminUsersController } from "./controllers/todoList/admin/users/TodolistAdminUsersController";
import { TodolistAdminAdminsController } from "./controllers/todoList/admin/admins/TodolistAdminAdminsController";
import { TodolistUserTodosController } from "./controllers/todoList/user/todos/TodolistUserTodosController";
import { TodolistAdminTodosController } from "./controllers/todoList/admin/todos/TodolistAdminTodosController";

@Module({
  controllers: [
    AuthUserController,
    AuthAdminController,
    TodolistAdminUsersController,
    TodolistAdminAdminsController,
    TodolistUserTodosController,
    TodolistAdminTodosController,
  ],
})
export class MyModule {}
