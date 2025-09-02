import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";

/**
 * Validate that token refresh fails on invalid, revoked, or expired tokens.
 *
 * This E2E test covers negative-path scenarios for /auth/user/refresh,
 * ensuring new tokens are not issued for incorrect, tampered, malformed, or
 * non-existent refresh tokens. The workflow fully simulates a user flow
 * including registration, email verification, login, and multiple
 * error-inducing refresh attempts.
 *
 * 1. Register a new user (randomized email and secure password)
 * 2. Verify email (with randomized token – in practice inject actual token if
 *    available)
 * 3. Log in to obtain a valid refresh token
 * 4. Attempt refresh with tampered token, expect failure
 * 5. Attempt refresh with random (nonexistent) token, expect failure
 * 6. Attempt refresh with malformed (obviously invalid) token, expect failure
 * 7. Assert that the endpoint rejects each invalid token and does not issue
 *    new tokens
 *
 * Note: This test cannot simulate actual expiry (time-bound) conditions in
 * a pure E2E test unless the system provides an interface for forced
 * expiry. Covered scenarios represent a strong approximation by simulating
 * all forms of 'broken' token values under business rules.
 */
export async function test_api_user_token_refresh_invalid_or_expired_token(
  connection: api.IConnection,
) {
  // 1. Register a new user and collect join response
  const email = typia.random<string & tags.Format<"email">>();
  const password = RandomGenerator.alphaNumeric(12);
  const registration = await api.functional.auth.user.join(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(registration);

  // 2. Verify email (simulate token; in a live system, use provided token)
  await api.functional.auth.user.verify_email.verifyEmail(connection, {
    body: {
      user_id: registration.user.id,
      token: typia.random<string>(), // Simulation: use real token if exposed by registration
    } satisfies ITodoListUser.IVerifyEmail,
  });

  // 3. Log in and retrieve a valid refresh token
  const login = await api.functional.auth.user.login(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListUser.ILogin,
  });
  typia.assert(login);
  const refreshToken = login.token.refresh;

  // 4a. Attempt refresh with tampered token
  const invalidToken = refreshToken + "_invalid";
  await TestValidator.error(
    "refresh fails on tampered refresh token",
    async () => {
      await api.functional.auth.user.refresh(connection, {
        body: { session_token: invalidToken } satisfies ITodoListUser.IRefresh,
      });
    },
  );

  // 4b. Attempt refresh with a random (nonexistent) token
  const randomToken = RandomGenerator.alphaNumeric(64);
  await TestValidator.error(
    "refresh fails on random (nonexistent) refresh token",
    async () => {
      await api.functional.auth.user.refresh(connection, {
        body: { session_token: randomToken } satisfies ITodoListUser.IRefresh,
      });
    },
  );

  // 4c. Attempt refresh with malformed/short token
  const malformedToken = "badtoken";
  await TestValidator.error(
    "refresh fails on malformed refresh token",
    async () => {
      await api.functional.auth.user.refresh(connection, {
        body: {
          session_token: malformedToken,
        } satisfies ITodoListUser.IRefresh,
      });
    },
  );
}
