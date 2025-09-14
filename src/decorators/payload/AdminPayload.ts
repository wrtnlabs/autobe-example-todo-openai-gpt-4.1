import { tags } from "typia";

/**
 * Admin JWT payload interface.
 *
 * - Id: Admin's UUID (primary key of todo_list_admin).
 * - Type: Discriminator, always "admin".
 */
export interface AdminPayload {
  /** Admin unique identifier (top-level principal for admin role) */
  id: string & tags.Format<"uuid">;

  /** Discriminator for role type. */
  type: "admin";
}
