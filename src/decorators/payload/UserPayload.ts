import { tags } from "typia";

/**
 * Payload structure for an authenticated todo list user (role: user).
 *
 * - Id: Top-level user table ID (todo_list_user.id, UUID)
 * - Type: Discriminated union identifier for role
 */
export interface UserPayload {
  /** Top-level user table ID (the fundamental user identifier in the system). */
  id: string & tags.Format<"uuid">;

  /** Discriminator for the discriminated union type. */
  type: "user";
}
