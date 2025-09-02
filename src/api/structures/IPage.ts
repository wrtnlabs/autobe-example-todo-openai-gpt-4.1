import { tags } from "typia";

export namespace IPage {
  /**
   * Pagination information for paginated data responses. Includes navigation
   * data (page, size, total, max pages) in alignment with the IPage
   * specification.
   */
  export type IPagination = {
    /** Current page number in this paginated query (starts at 1). */
    current: number & tags.Type<"int32">;

    /** Maximum number of records per page. */
    limit: number & tags.Type<"int32">;

    /** Total number of matching records found for this query. */
    records: number & tags.Type<"int32">;

    /**
     * Total number of pages available based on record count and per-page
     * limit.
     */
    pages: number & tags.Type<"int32">;
  };
}
