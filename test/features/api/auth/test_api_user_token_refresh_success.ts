import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";

/**
 * Test successful JWT token refresh for an authenticated user.
 *
 * - Register a new user for a unique credential set.
 * - Verify the user's email address to enable login.
 * - Perform login to obtain a valid session with both access and refresh
 *   tokens.
 * - Call the refresh endpoint with the valid refresh token.
 * - Confirm:
 *
 *   - A new access token and a new refresh token are returned.
 *   - The tokens have correct structure and expected validity window.
 *   - The session's business integrity rules (such as expiration policy) are
 *       respected.
 *   - The session is not revoked or interrupted by the refresh process.
 *   - The returned user summary is for the correct, verified user.
 */
export async function test_api_user_token_refresh_success(
  connection: api.IConnection,
) {
  // Step 1: Register a new user
  const email = typia.random<string & tags.Format<"email">>();
  const password = RandomGenerator.alphaNumeric(12);
  const joinBody = { email, password } satisfies ITodoListUser.IJoin;
  const registered = await api.functional.auth.user.join(connection, {
    body: joinBody,
  });
  typia.assert(registered);
  TestValidator.equals(
    "registered user email matches input",
    registered.user.email,
    email,
  );
  TestValidator.predicate(
    "email for registered user is not initially verified",
    !registered.user.is_email_verified,
  );

  // Extract the verification token for this user (test e2e context; in real-world, get token from test fixtures/log)
  const verificationToken = (registered as any).user.verification_token as
    | string
    | undefined;
  TestValidator.predicate(
    "email verification token is available for new user",
    typeof verificationToken === "string" && verificationToken.length > 0,
  );

  // Step 2: Verify the user's email
  await api.functional.auth.user.verify_email.verifyEmail(connection, {
    body: {
      user_id: registered.user.id,
      token: verificationToken!,
    } satisfies ITodoListUser.IVerifyEmail,
  });

  // Step 3: Login with verified credentials
  const loginBody = { email, password } satisfies ITodoListUser.ILogin;
  const loginResult = await api.functional.auth.user.login(connection, {
    body: loginBody,
  });
  typia.assert(loginResult);
  TestValidator.equals(
    "login response user email matches",
    loginResult.user.email,
    email,
  );
  TestValidator.predicate(
    "login response: user is_email_verified == true",
    loginResult.user.is_email_verified,
  );
  TestValidator.predicate(
    "login response includes session access and refresh tokens",
    typeof loginResult.token.access === "string" &&
      typeof loginResult.token.refresh === "string",
  );

  // Step 4: Call the refresh endpoint with a valid refresh token
  const refreshBody = {
    session_token: loginResult.token.refresh,
  } satisfies ITodoListUser.IRefresh;
  const refreshResult = await api.functional.auth.user.refresh(connection, {
    body: refreshBody,
  });
  typia.assert(refreshResult);
  TestValidator.equals(
    "refreshed user matches login user",
    refreshResult.user.id,
    loginResult.user.id,
  );
  TestValidator.equals(
    "refreshed user is_email_verified == true",
    refreshResult.user.is_email_verified,
    true,
  );
  TestValidator.notEquals(
    "refreshed access token should differ from previous",
    refreshResult.token.access,
    loginResult.token.access,
  );
  TestValidator.notEquals(
    "refreshed refresh token should differ from previous",
    refreshResult.token.refresh,
    loginResult.token.refresh,
  );
  TestValidator.predicate(
    "refreshed access token is non-empty string",
    typeof refreshResult.token.access === "string" &&
      refreshResult.token.access.length > 0,
  );
  TestValidator.predicate(
    "refreshed refresh token is non-empty string",
    typeof refreshResult.token.refresh === "string" &&
      refreshResult.token.refresh.length > 0,
  );
  TestValidator.predicate(
    "refreshed token expired_at is in the future",
    new Date(refreshResult.token.expired_at).getTime() > Date.now(),
  );
  TestValidator.predicate(
    "refreshed refreshable_until is in the future",
    new Date(refreshResult.token.refreshable_until).getTime() > Date.now(),
  );
}
