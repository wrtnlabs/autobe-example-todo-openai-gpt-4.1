import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { IPage } from "@ORGANIZATION/PROJECT-api/lib/structures/IPage";
import type { IPageITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListAdmin";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";

/**
 * Validate the search, pagination, and filtering of admin accounts using the
 * admin listing API.
 *
 * Steps:
 *
 * 1. Register multiple distinct admins with varying email, name, privilege, and
 *    status.
 * 2. Login with one admin to authenticate further requests.
 * 3. Use PATCH /todoList/admin/admins to search by partial email/name, apply
 *    status/privilege filters, sort and paginate.
 * 4. Validate that only matching admins are returned, no password_hash is present,
 *    and pagination info makes sense.
 */
export async function test_api_admin_admins_search_pagination_filtering(
  connection: api.IConnection,
) {
  // 1. Register 5 distinct admins with known pass and varied props
  const possibleStatuses = [
    "active",
    "locked",
    "disabled",
    "suspended",
  ] as const;
  const possiblePrivileges = ["superadmin", "support", "auditor"] as const;
  const admins = await ArrayUtil.asyncRepeat(5, async (i) => {
    const status = RandomGenerator.pick(possibleStatuses);
    const privilege = RandomGenerator.pick(possiblePrivileges);
    const email = `${RandomGenerator.alphabets(12)}${i}@test.com`;
    const name = RandomGenerator.name();
    const password_hash = RandomGenerator.alphaNumeric(20);
    const joinBody = {
      email,
      password_hash,
      name,
      avatar_uri: null,
      status,
      privilege_level: privilege,
    } satisfies ITodoListAdmin.IJoin;
    const auth = await api.functional.auth.admin.join(connection, {
      body: joinBody,
    });
    typia.assert(auth);
    return { auth, status, privilege, email, name, password_hash };
  });

  // 2. Login as the first admin for context
  const loginBody = {
    email: admins[0].email,
    password: admins[0].password_hash,
  } satisfies ITodoListAdmin.ILogin;
  const session = await api.functional.auth.admin.login(connection, {
    body: loginBody,
  });
  typia.assert(session);

  // 3. Query: partial email filter (use `@test.com` substring)
  const res1 = await api.functional.todoList.admin.admins.index(connection, {
    body: {
      email: "@test.com",
      page: 1 as number & tags.Type<"int32"> & tags.Minimum<1>,
      limit: 5 as number &
        tags.Type<"int32"> &
        tags.Minimum<1> &
        tags.Maximum<100>,
      sort_by: "created_at",
      direction: "asc",
    } satisfies ITodoListAdmin.IRequest,
  });
  typia.assert(res1);
  TestValidator.predicate(
    "admins matching email substring filter returned",
    res1.data.every((adm) => adm.email.includes("@test.com")),
  );
  TestValidator.equals(
    "pagination (limit matches request)",
    res1.pagination.limit,
    5,
  );
  // Ensure password_hash never appears
  TestValidator.predicate(
    "no password_hash returned in summaries",
    res1.data.every((adm) => !("password_hash" in adm)),
  );

  // 4. Filter by privilege_level
  const filterPrivilege = admins[2].privilege;
  const res2 = await api.functional.todoList.admin.admins.index(connection, {
    body: {
      privilege_level: filterPrivilege,
      page: 1 as number & tags.Type<"int32"> & tags.Minimum<1>,
      limit: 10 as number &
        tags.Type<"int32"> &
        tags.Minimum<1> &
        tags.Maximum<100>,
      sort_by: "email",
      direction: "desc",
    } satisfies ITodoListAdmin.IRequest,
  });
  typia.assert(res2);
  TestValidator.predicate(
    "filtered privilege_level admins returned",
    res2.data.every((adm) => adm.privilege_level === filterPrivilege),
  );

  // 5. Filter by status
  const filterStatus = admins[3].status;
  const res3 = await api.functional.todoList.admin.admins.index(connection, {
    body: {
      status: filterStatus,
      page: 1 as number & tags.Type<"int32"> & tags.Minimum<1>,
      limit: 10 as number &
        tags.Type<"int32"> &
        tags.Minimum<1> &
        tags.Maximum<100>,
      sort_by: "created_at",
      direction: "asc",
    } satisfies ITodoListAdmin.IRequest,
  });
  typia.assert(res3);
  TestValidator.predicate(
    "filtered status admins returned",
    res3.data.every((adm) => adm.status === filterStatus),
  );

  // 6. Query with pagination (limit=2, page 2)
  const resPage = await api.functional.todoList.admin.admins.index(connection, {
    body: {
      page: 2 as number & tags.Type<"int32"> & tags.Minimum<1>,
      limit: 2 as number &
        tags.Type<"int32"> &
        tags.Minimum<1> &
        tags.Maximum<100>,
      sort_by: "created_at",
      direction: "desc",
    } satisfies ITodoListAdmin.IRequest,
  });
  typia.assert(resPage);
  TestValidator.equals(
    "pagination page matches (2)",
    resPage.pagination.current,
    2,
  );
}
