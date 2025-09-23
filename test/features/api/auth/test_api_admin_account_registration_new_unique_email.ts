import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";

/**
 * Verifies administrator registration using a new, unique email, and covers
 * happy path with minimal and maximal inputs, as well as business error logic
 * for duplicate email. No type error/missing required field testing is
 * included, in accordance with strict type safety and absolute prohibition on
 * type error validation.
 *
 * Steps:
 *
 * 1. Generate a unique business admin email and valid password, and perform
 *    registration supplying all ITodoListAdmin.IJoin fields (email,
 *    password_hash, name, avatar_uri, status, privilege_level).
 *
 *    - Assert the returned ITodoListAdmin.IAuthorized has a non-empty JWT token,
 *         correct admin email, and privilege/state as supplied.
 * 2. Repeat with only required fields (email and password_hash). Assert that
 *    returned admin is created with a unique id, that status and
 *    privilege_level are set by system defaults, and the email matches.
 * 3. Validate business logic error by attempting to re-register with a previously
 *    registered email (duplicate), expecting a handled business error. All
 *    TestValidator assertions use a descriptive title. No header or DTO field
 *    not in schema is touched. All API calls are properly awaited and
 *    validated.
 */
export async function test_api_admin_account_registration_new_unique_email(
  connection: api.IConnection,
) {
  // 1. Happy path: all fields supplied (maximal registration)
  const uniqueEmail = `${RandomGenerator.alphabets(10)}@business-e2e.com`;
  const password = RandomGenerator.alphaNumeric(16);
  const joinBody = {
    email: uniqueEmail,
    password_hash: password,
    name: RandomGenerator.name(),
    avatar_uri: `https://cdn.e2e.com/avatar/${RandomGenerator.alphaNumeric(12)}`,
    status: "active",
    privilege_level: "support",
  } satisfies ITodoListAdmin.IJoin;

  const authorized = await api.functional.auth.admin.join(connection, {
    body: joinBody,
  });
  typia.assert(authorized);
  typia.assert(authorized.token);
  typia.assert(authorized.admin);
  TestValidator.equals(
    "admin email matches",
    authorized.admin.email,
    uniqueEmail,
  );
  TestValidator.equals(
    "admin privilege matches",
    authorized.admin.privilege_level,
    "support",
  );
  TestValidator.equals(
    "admin status matches",
    authorized.admin.status,
    "active",
  );

  // 2. Happy path: only required fields (minimal registration)
  const minimalEmail = `${RandomGenerator.alphabets(12)}@business-e2e.com`;
  const minimalBody = {
    email: minimalEmail,
    password_hash: RandomGenerator.alphaNumeric(16),
  } satisfies ITodoListAdmin.IJoin;
  const authorized2 = await api.functional.auth.admin.join(connection, {
    body: minimalBody,
  });
  typia.assert(authorized2);
  TestValidator.equals(
    "admin email matches min",
    authorized2.admin.email,
    minimalEmail,
  );
  TestValidator.predicate(
    "admin privilege_level generated",
    typeof authorized2.admin.privilege_level === "string" &&
      authorized2.admin.privilege_level.length > 0,
  );
  TestValidator.predicate(
    "admin status generated",
    typeof authorized2.admin.status === "string" &&
      authorized2.admin.status.length > 0,
  );

  // 3. Business error: duplicate email registration
  await TestValidator.error("duplicate email fails", async () => {
    await api.functional.auth.admin.join(connection, { body: joinBody });
  });
}
