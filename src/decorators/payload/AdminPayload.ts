import { tags } from "typia";

/**
 * JWT payload for admin role authentication.
 *
 * - Id: Top-level admin table ID (todo_list_admins.id)
 * - Type: Discriminator for admin role
 */
export interface AdminPayload {
  /** Top-level admin table ID (todo_list_admins.id) */
  id: string & tags.Format<"uuid">;

  /** Discriminator for the admin role */
  type: "admin";
}
