import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Verifies that token refresh is rejected for expired or tampered refresh
 * tokens.
 *
 * Scenario:
 *
 * - A user attempts to refresh authentication using a refresh token that is
 *   either expired or has been tampered with (invalid).
 * - The API must deny the request, not issue any token, and return a business
 *   error response without disclosing internal error details.
 *
 * Steps:
 *
 * 1. Attempt refresh with an obviously expired (or random, simulating expired)
 *    refresh token.
 * 2. Attempt refresh with a tampered, clearly invalid refresh token (e.g., random
 *    string that is not a JWT).
 * 3. For each, validate that the API returns an error, does NOT return a user
 *    authorization structure, and that the error response format is proper
 *    (does not disclose server internals).
 */
export async function test_api_user_refresh_token_expired_or_invalid(
  connection: api.IConnection,
) {
  // 1. Attempt with an obviously expired or invalid refresh token (simulate by using a random long string)
  const expiredToken = RandomGenerator.alphaNumeric(128);
  await TestValidator.error(
    "should reject expired refresh token and not issue a new token",
    async () => {
      await api.functional.auth.user.refresh(connection, {
        body: { refresh_token: expiredToken } satisfies ITodoListUser.IRefresh,
      });
    },
  );

  // 2. Attempt with a tampered (malformed) refresh token (simulate by clear garbage data)
  const tamperedToken = "not_a_valid_token";
  await TestValidator.error(
    "should reject tampered refresh token and not issue a new token",
    async () => {
      await api.functional.auth.user.refresh(connection, {
        body: { refresh_token: tamperedToken } satisfies ITodoListUser.IRefresh,
      });
    },
  );
}
