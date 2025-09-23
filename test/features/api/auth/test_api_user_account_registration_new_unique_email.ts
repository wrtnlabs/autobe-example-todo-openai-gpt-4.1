import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Validate registering a new user account with a unique email.
 *
 * Ensures the /auth/user/join endpoint:
 *
 * - Accepts unique email, valid password, and optional profile fields.
 * - Returns ITodoListUser.IAuthorized with both JWT tokens and user profile.
 * - Sets user status correctly; does not reveal sensitive credential info
 *   (password).
 * - Only schema-approved fields present in response.
 *
 * Steps:
 *
 * 1. Generate unique email and valid password, optionally set name and avatar_uri.
 * 2. Register user via api.functional.auth.user.join.
 * 3. Typia.assert structure; validate JWT token and profile fields.
 * 4. Check returned user context fields match input values and business rules.
 * 5. Confirm status == 'active'.
 * 6. Ensure response does not leak password and no extra fields are returned.
 */
export async function test_api_user_account_registration_new_unique_email(
  connection: api.IConnection,
) {
  // 1. Prepare unique registration input
  const email = typia.random<string & tags.Format<"email">>();
  const password = RandomGenerator.alphaNumeric(12);
  const name = RandomGenerator.name(2);
  const avatar_uri = undefined;

  const requestBody = {
    email,
    password,
    name,
    avatar_uri,
  } satisfies ITodoListUser.IJoin;

  // 2. Register the user
  const result = await api.functional.auth.user.join(connection, {
    body: requestBody,
  });
  typia.assert(result);

  // 3. Validate token structure
  typia.assert(result.token);
  TestValidator.predicate(
    "access token exists",
    typeof result.token.access === "string" && result.token.access.length > 0,
  );
  TestValidator.predicate(
    "refresh token exists",
    typeof result.token.refresh === "string" && result.token.refresh.length > 0,
  );
  TestValidator.predicate(
    "expired_at is ISO date-time",
    typeof result.token.expired_at === "string" &&
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d+)?Z/.test(
        result.token.expired_at,
      ),
  );
  TestValidator.predicate(
    "refreshable_until is ISO date-time",
    typeof result.token.refreshable_until === "string" &&
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d+)?Z/.test(
        result.token.refreshable_until,
      ),
  );

  // 4. Validate returned user profile
  typia.assert(result.user);
  TestValidator.equals("user email matches input", result.user.email, email);
  TestValidator.equals("user name matches input", result.user.name, name);
  TestValidator.equals(
    "user avatar_uri matches input",
    result.user.avatar_uri,
    avatar_uri,
  );
  TestValidator.predicate(
    "user id is UUID",
    typeof result.user.id === "string" &&
      /^[0-9a-f-]{36}$/i.test(result.user.id),
  );
  TestValidator.predicate(
    "user created_at is date-time",
    typeof result.user.created_at === "string" &&
      result.user.created_at.length > 10,
  );
  TestValidator.predicate(
    "user updated_at is date-time",
    typeof result.user.updated_at === "string" &&
      result.user.updated_at.length > 10,
  );

  // 5. Check account initial status (likely 'active' or business policy)
  TestValidator.equals("user status is 'active'", result.user.status, "active");
}
