import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";

/**
 * Validate the registration of a new Todo List admin using minimal required
 * onboarding fields.
 *
 * This test ensures a new admin can be created by providing a unique email and
 * a password that satisfies minimum strength (at least 8 characters). It
 * verifies that the /auth/admin/join endpoint returns a properly shaped
 * IAuthorized response containing:
 *
 * - A UUID id
 * - The same unique email as used in registration
 * - Created_at and updated_at as ISO 8601 timestamps
 * - A token object with both access and refresh JWTs, and correct expiration
 *   fields The response and all nested fields are validated using typia.assert,
 *   confirming strict compliance with authentication and business onboarding
 *   contracts. The test does NOT check error flows (such as duplicate
 *   registration or short passwords) as only the minimal valid registration
 *   scenario is required.
 */
export async function test_api_admin_registration(connection: api.IConnection) {
  // Generate email and password according to DTO constraints
  const email = typia.random<string & tags.Format<"email">>();
  const password = RandomGenerator.alphaNumeric(10); // minLength<8>

  // Attempt registration
  const admin = await api.functional.auth.admin.join(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListAdmin.ICreate,
  });
  // Full type validation
  typia.assert(admin);

  // Business property checks
  TestValidator.equals("returned email matches input", admin.email, email);
  TestValidator.predicate(
    "admin id is valid UUID",
    typeof admin.id === "string" && admin.id.length === 36,
  );
  TestValidator.predicate(
    "created_at is ISO string",
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/.test(admin.created_at),
  );
  TestValidator.predicate(
    "updated_at is ISO string",
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/.test(admin.updated_at),
  );
  // Token fields are non-empty
  TestValidator.predicate(
    "access token exists",
    typeof admin.token.access === "string" && admin.token.access.length > 0,
  );
  TestValidator.predicate(
    "refresh token exists",
    typeof admin.token.refresh === "string" && admin.token.refresh.length > 0,
  );
  TestValidator.predicate(
    "expired_at is ISO string",
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/.test(admin.token.expired_at),
  );
  TestValidator.predicate(
    "refreshable_until is ISO string",
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/.test(
      admin.token.refreshable_until,
    ),
  );
}
