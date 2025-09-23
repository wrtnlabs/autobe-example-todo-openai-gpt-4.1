import { tags } from "typia";

/**
 * Payload injected when a user is authenticated through UserAuth.
 *
 * - Id: todo_list_users.id (top-level user identifier)
 * - Type: always 'user' for standard members
 */
export interface UserPayload {
  /** Top-level user table ID (unique identifier for the user). */
  id: string & tags.Format<"uuid">;

  /** Discriminator for the user role. */
  type: "user";
}
