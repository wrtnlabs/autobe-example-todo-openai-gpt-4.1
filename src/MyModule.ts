import { Module } from "@nestjs/common";

import { AuthUserController } from "./controllers/auth/user/AuthUserController";
import { AuthUserVerify_emailController } from "./controllers/auth/user/verify-email/AuthUserVerify_emailController";
import { AuthUserRequest_password_resetController } from "./controllers/auth/user/request-password-reset/AuthUserRequest_password_resetController";
import { AuthUserReset_passwordController } from "./controllers/auth/user/reset-password/AuthUserReset_passwordController";
import { TodolistUserTodosController } from "./controllers/todoList/user/todos/TodolistUserTodosController";
import { TodolistUserTodosDeletedController } from "./controllers/todoList/user/todos/deleted/TodolistUserTodosDeletedController";
import { TodolistUserDeletedtodologsController } from "./controllers/todoList/user/deletedTodoLogs/TodolistUserDeletedtodologsController";

@Module({
  controllers: [
    AuthUserController,
    AuthUserVerify_emailController,
    AuthUserRequest_password_resetController,
    AuthUserReset_passwordController,
    TodolistUserTodosController,
    TodolistUserTodosDeletedController,
    TodolistUserDeletedtodologsController,
  ],
})
export class MyModule {}
