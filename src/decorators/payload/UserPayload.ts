import { tags } from "typia";

/**
 * Authenticated payload for a regular user.
 *
 * - Id: Top-level user ID (todo_list_users.id)
 * - Type: Always 'user'
 */
export interface UserPayload {
  /** Unique identifier for the user account (todo_list_users.id) */
  id: string & tags.Format<"uuid">;

  /** Discriminator for the user role */
  type: "user";
}
