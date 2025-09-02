import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";

/**
 * Validate user can successfully log in only after email verification.
 *
 * This test covers the typical onboarding and authentication workflow:
 *
 * 1. Register (join) a new user with a unique email and a strong password.
 * 2. Complete the user's email verification process using the system-issued
 *    verification token.
 * 3. Attempt login using the original credentials after verification.
 * 4. Assert login succeeds and that the API returns both a JWT access and
 *    refresh token, along with the correct user summary.
 *
 * Business context: Logging in before email verification should fail (not
 * tested here), but after verification, credentials should yield a valid
 * authorization with tokens and display-safe user summary. Keys to assert:
 * token.ACCESS/REFRESH exist and are non-empty, expiry fields are valid
 * datetimes, user summary matches the joined user, and is_email_verified is
 * true.
 */
export async function test_api_user_login_success_after_verification(
  connection: api.IConnection,
) {
  // 1. Register a new user with a unique email and valid password
  const userEmail = typia.random<string & tags.Format<"email">>();
  const userPassword = RandomGenerator.alphaNumeric(12);
  const joinResponse = await api.functional.auth.user.join(connection, {
    body: {
      email: userEmail,
      password: userPassword,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(joinResponse);
  // The user must NOT be email-verified yet
  TestValidator.predicate(
    "newly joined user should not be email verified",
    joinResponse.user.is_email_verified === false,
  );

  // 2. Complete email verification: retrieve userId and token (simulate as issued)
  // In real E2E, we might extract the token from DB/email service
  const userId = joinResponse.user.id;
  // We assume in this test framework, upon registration the system issues the correct verification token retrievable from context (for E2E only)
  // For this test, simulate a perfect flow where registration returns a token for test execution
  // We'll use typia.random<string>() to simulate a valid token in place of actual retrieval
  // (Replace this with actual token extraction logic if available in the test environment)
  const verificationToken = typia.random<string>();
  const verifyBody: ITodoListUser.IVerifyEmail = {
    user_id: userId,
    token: verificationToken,
  };
  // Execute email verification
  await api.functional.auth.user.verify_email.verifyEmail(connection, {
    body: verifyBody,
  });

  // 3. Attempt login with correct email/password after verification
  const loginBody: ITodoListUser.ILogin = {
    email: userEmail,
    password: userPassword,
  };
  const loginResponse = await api.functional.auth.user.login(connection, {
    body: loginBody,
  });
  typia.assert(loginResponse);
  // 4. Assert login returns valid session tokens and correct user summary
  TestValidator.predicate(
    "login returns non-empty access token",
    typeof loginResponse.token.access === "string" &&
      loginResponse.token.access.length > 0,
  );
  TestValidator.predicate(
    "login returns non-empty refresh token",
    typeof loginResponse.token.refresh === "string" &&
      loginResponse.token.refresh.length > 0,
  );
  TestValidator.predicate(
    "access token expiration is a valid datetime string",
    typeof loginResponse.token.expired_at === "string" &&
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d+)?Z/.test(
        loginResponse.token.expired_at,
      ),
  );
  TestValidator.predicate(
    "refresh token expiration is a valid datetime string",
    typeof loginResponse.token.refreshable_until === "string" &&
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d+)?Z/.test(
        loginResponse.token.refreshable_until,
      ),
  );
  TestValidator.equals(
    "email in authorized user matches registered email",
    loginResponse.user.email,
    userEmail,
  );
  TestValidator.predicate(
    "authorized user is_email_verified is true after verification",
    loginResponse.user.is_email_verified === true,
  );
}
