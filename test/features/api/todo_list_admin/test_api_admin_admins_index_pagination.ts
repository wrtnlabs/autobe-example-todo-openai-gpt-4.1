import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { IPage } from "@ORGANIZATION/PROJECT-api/lib/structures/IPage";
import type { IPageITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListAdmin";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";

/**
 * Validate that an authenticated admin can retrieve a paginated list of admin
 * accounts.
 *
 * 1. Register a new admin using unique, random email and password.
 * 2. Issue several additional admins (to verify pagination and listing content
 *    order).
 * 3. Request the /todoList/admin/admins index endpoint as authenticated admin:
 *
 *    - Default pagination (no body, or empty body)
 *    - Custom page/limit
 *    - Filter by email (partial match)
 * 4. Validate returned data structure, fields, and pagination content makes sense.
 * 5. Logout or simulate as unauthenticated: request the endpoint to confirm
 *    forbidden access.
 */
export async function test_api_admin_admins_index_pagination(
  connection: api.IConnection,
) {
  // 1. Register a new admin
  const adminBody = {
    email: typia.random<string & tags.Format<"email">>(),
    password: RandomGenerator.alphabets(10),
  } satisfies ITodoListAdmin.ICreate;
  const admin = await api.functional.auth.admin.join(connection, {
    body: adminBody,
  });
  typia.assert(admin);

  // 2. Create additional admins for pagination/variation
  const admins = await ArrayUtil.asyncMap(
    ArrayUtil.repeat(4, (i) => i),
    async () => {
      const body = {
        email: typia.random<string & tags.Format<"email">>(),
        password: RandomGenerator.alphabets(10),
      } satisfies ITodoListAdmin.ICreate;
      const created = await api.functional.auth.admin.join(connection, {
        body,
      });
      typia.assert(created);
      return created;
    },
  );

  // 3. Request paginated admin list (default: page 1, limit 100)
  const outDefault = await api.functional.todoList.admin.admins.index(
    connection,
    {
      body: {} satisfies ITodoListAdmin.IRequest,
    },
  );
  typia.assert(outDefault);
  TestValidator.predicate(
    "should have at least one admin listed",
    outDefault.data.length > 0,
  );
  TestValidator.predicate(
    "pagination meta should match sum of admins count",
    outDefault.pagination.records >= admins.length + 1,
  );

  // 3b. Request admin list with custom page/limit
  const outCustom = await api.functional.todoList.admin.admins.index(
    connection,
    {
      body: { page: 1, limit: 2 } satisfies ITodoListAdmin.IRequest,
    },
  );
  typia.assert(outCustom);
  TestValidator.equals(
    "custom limit reflected in result",
    outCustom.pagination.limit,
    2,
  );

  // 3c. Request with email filter (using the just-created admin's email substring)
  const emailPartial = admin.email.substring(0, admin.email.indexOf("@"));
  const outFilter = await api.functional.todoList.admin.admins.index(
    connection,
    {
      body: { email: emailPartial } satisfies ITodoListAdmin.IRequest,
    },
  );
  typia.assert(outFilter);
  TestValidator.predicate(
    "filtered result contains at least matching email",
    outFilter.data.some((summary) => summary.email.includes(emailPartial)),
  );

  // 4. Logout: simulate request as unauthenticated (new connection w/o headers)
  const unauthConn: api.IConnection = { ...connection, headers: {} };
  await TestValidator.error(
    "should reject unauthenticated access",
    async () => {
      await api.functional.todoList.admin.admins.index(unauthConn, {
        body: {} satisfies ITodoListAdmin.IRequest,
      });
    },
  );
}
