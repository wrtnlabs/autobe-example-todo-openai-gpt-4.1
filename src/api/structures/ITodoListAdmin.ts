import { tags } from "typia";

import { IAuthorizationToken } from "./IAuthorizationToken";

export namespace ITodoListAdmin {
  /**
   * Request body for registering a new admin account in the Todo List
   * application. Contains only the unique email and supplied password to be
   * hashed and persisted securely as defined in the todo_list_admin Prisma
   * schema.
   */
  export type ICreate = {
    /**
     * Admin's unique email address for registration. Required as the
     * credential for privileged access in the system, and subject to unique
     * constraint in the todo_list_admin table. This is never shared with
     * regular users and must follow secure onboarding rules.
     */
    email: string & tags.Format<"email">;

    /**
     * Admin's plain text password for registration. Must meet higher
     * security requirements suitable for privileged accounts. Only supplied
     * on creation, never stored or returned. Backend hashes and stores this
     * value securely as password_hash in the database.
     */
    password: string & tags.MinLength<8> & tags.MaxLength<100>;
  };

  /**
   * Defines the input required to authenticate an admin for the Todo List
   * system. These are mapped directly to the todo_list_admin entity,
   * controlling privileged access.
   */
  export type ILogin = {
    /**
     * Admin's unique email address for authentication. Must be unique per
     * admin and used as primary login credential for privileged access.
     * (Prisma: todo_list_admin.email)
     */
    email: string & tags.Format<"email">;

    /**
     * Admin's raw password for authentication. Not persisted; used only for
     * login, where it is securely hashed and compared to `password_hash`
     * from the database. Must meet minimum security criteria as defined by
     * business rules. Never returned in responses.
     */
    password: string;
  };

  /**
   * Defines the input required for admin JWT token refresh. Only the
   * previously issued refresh_token is accepted.
   */
  export type IRefresh = {
    /**
     * Refresh token, as issued in previous authorization response. Used for
     * session renewal.
     */
    refresh_token: string;
  };

  /**
   * Authorization response for admin login/join/refresh. Returns the admin
   * user id and a JWT token structure for session management.
   */
  export type IAuthorized = {
    /** Unique identifier of the authenticated admin user (UUID). */
    id: string & tags.Format<"uuid">;

    /** JWT token information for authentication */
    token: IAuthorizationToken;
  };
}
