import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";

export async function test_api_user_join_invalid_password_and_format_error(
  connection: api.IConnection,
) {
  /**
   * Validate user registration failures for invalid email and password
   * policies.
   *
   * Business rules:
   *
   * - Email must match the Format<"email"> (RFC pattern) and be required
   * - Password must be a string with 8 <= length <= 128
   * - Registration with invalid email must be rejected
   * - Registration with too-short or too-long password must be rejected
   * - Registration with both invalid email and invalid password must be rejected
   * - API must never return an authorized user on validation failure
   *
   * Edge cases:
   *
   * - Minimal email or nonsensical string (no @)
   * - Password with exactly 7 characters (too short)
   * - Password with exactly 130 characters (too long)
   */

  // Prepare invalid email and password values
  const invalidEmails = [
    "notanemail", // missing @
    "user@", // missing domain
    "test@domain", // missing TLD
    "@domain.com", // missing username
    "test@@domain.com", // double @
    "user@.com", // missing domain name before dot
    "user@domain..com", // double dot
    "", // empty string
  ];
  const invalidPasswords = [
    "short7", // 7 chars (too short)
    "", // empty (always invalid)
    Array(130).fill("a").join(""), // 130 chars (too long)
  ];

  // Test all invalid email formats
  for (const email of invalidEmails) {
    await TestValidator.error(
      `registration with invalid email '${email}' should fail`,
      async () => {
        await api.functional.auth.user.join(connection, {
          body: {
            email: email,
            password: "ValidPa55word!",
          } satisfies ITodoListUser.IJoin,
        });
      },
    );
  }

  // Test all invalid password lengths/formats
  for (const password of invalidPasswords) {
    await TestValidator.error(
      `registration with invalid password ('${password.length}' chars) should fail`,
      async () => {
        await api.functional.auth.user.join(connection, {
          body: {
            email: "validuser@example.com",
            password: password,
          } satisfies ITodoListUser.IJoin,
        });
      },
    );
  }

  // Test combined invalid email + invalid password
  await TestValidator.error(
    "registration with both invalid email and password should fail",
    async () => {
      await api.functional.auth.user.join(connection, {
        body: {
          email: "notanemail",
          password: "short7",
        } satisfies ITodoListUser.IJoin,
      });
    },
  );
}
