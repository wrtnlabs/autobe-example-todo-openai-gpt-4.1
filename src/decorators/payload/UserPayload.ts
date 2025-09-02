import { tags } from "typia";

/** Payload type injected into controller methods for authenticated user. */
export interface UserPayload {
  /** Top-level user table ID (the fundamental user identifier in the system). */
  id: string & tags.Format<"uuid">;

  /** Discriminator for the discriminated union type. */
  type: "user";
}
