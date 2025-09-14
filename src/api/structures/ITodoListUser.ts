import { tags } from "typia";

import { IAuthorizationToken } from "./IAuthorizationToken";

export namespace ITodoListUser {
  /**
   * Input body for new user registration in the Todo List application. Mapped
   * to the todo_list_user entity for creation, with email uniqueness
   * constraint and secure password handling. Only email and password fields
   * are accepted from the client. All business rules for registration,
   * validation, and internal storage/processing are enforced as defined in
   * the requirements analysis and Prisma schema.
   */
  export type IJoin = {
    /**
     * User's unique email address for registration and login. Must comply
     * with RFC 5322 format for emails. This is the primary business
     * identifier for authentication, as specified in the todo_list_user
     * schema and requirements documentation.
     *
     * The email address must be unique across all users in the system. The
     * system enforces uniqueness and will reject registration if the email
     * already exists.
     */
    email: string & tags.Format<"email">;

    /**
     * User-supplied plain text password. Must meet business requirements
     * for strength, length (typically at least 8 characters), and is never
     * stored or returned in responses. The backend hashes this password and
     * persists only the hash (password_hash). In case of registration
     * failure or errors, this value is never exposed externally.
     */
    password: string & tags.MinLength<8> & tags.MaxLength<100>;
  };

  /**
   * Request body for user login (authentication) in the Todo List
   * application. Contains only email and password properties, as required by
   * business rules for authenticating a user against the todo_list_user
   * schema.
   */
  export type ILogin = {
    /**
     * User's email address for login. Must already be present in the
     * database as a registered user. Used as the primary credential for
     * authentication, as explicitly defined in the todo_list_user table.
     */
    email: string & tags.Format<"email">;

    /**
     * Plain text password supplied for authentication. Must meet security
     * policy requirements for password strength. The value is never
     * returned in responses, only checked against the stored password_hash
     * for verification.
     */
    password: string & tags.MinLength<8> & tags.MaxLength<100>;
  };

  /**
   * Request body for session token renewal for a Todo List user. Accepts only
   * a refresh token string as input, as required for continuing an
   * authenticated session. See business documentation on JWT lifecycle and
   * refresh process.
   */
  export type IRefresh = {
    /**
     * Refresh token previously issued to the user for session renewal. Must
     * be valid, non-expired, and mapped to an existing authenticated user
     * as per business policy. Required for secure, stateless session
     * continuation process.
     */
    refresh_token: string;
  };

  /**
   * Response body for successful authentication or registration of a user.
   * Contains only id and token properties for security. No password or hash
   * fields are ever returned as per schema and requirements.
   */
  export type IAuthorized = {
    /**
     * The unique identifier of the authenticated user, as defined in the
     * todo_list_user Prisma schema (id, UUID v4). Used for later
     * client-side API interactions.
     */
    id: string & tags.Format<"uuid">;

    /** JWT token information for authentication */
    token: IAuthorizationToken;
  };
}
