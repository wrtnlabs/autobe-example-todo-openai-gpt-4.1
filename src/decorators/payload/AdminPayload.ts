import { tags } from "typia";

/**
 * JWT payload for administrator authentication.
 *
 * - Id: administrator's table id (UUID, standalone admin, not user id)
 * - Type: always "admin" for discriminator
 */
export interface AdminPayload {
  /** Top-level admin table ID (the fundamental admin identifier in the system). */
  id: string & tags.Format<"uuid">;

  /** Discriminator for the discriminated union type. */
  type: "admin";
}
