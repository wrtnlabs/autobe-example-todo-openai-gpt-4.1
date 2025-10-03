import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { IPage } from "@ORGANIZATION/PROJECT-api/lib/structures/IPage";
import type { IPageITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListUser";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Validate the admin-only paginated and searchable user list endpoint with
 * various paging, email filter, and sort options, as well as access control
 * enforcement.
 *
 * 1. Register a new admin account
 * 2. List users as admin, retrieve first page
 * 3. List users as admin, request a specific limit
 * 4. List users as admin, search by random email substring (if any user exists)
 * 5. List users as admin, sort by email ascending and descending and by created_at
 *    ascending/descending
 * 6. Attempt to list users without authentication to verify access is forbidden
 */
export async function test_api_admin_list_users_paging_and_search(
  connection: api.IConnection,
) {
  // 1. Register and login as new admin
  const adminEmail: string = typia.random<string & tags.Format<"email">>();
  const admin: ITodoListAdmin.IAuthorized =
    await api.functional.auth.admin.join(connection, {
      body: {
        email: adminEmail,
        password: RandomGenerator.alphaNumeric(12),
      } satisfies ITodoListAdmin.ICreate,
    });
  typia.assert(admin);

  // 2. List users as admin - default paging (should succeed)
  const defaultRes: IPageITodoListUser.ISummary =
    await api.functional.todoList.admin.users.index(connection, {
      body: {},
    });
  typia.assert(defaultRes);
  TestValidator.predicate(
    "response includes only safe user fields (id, email, created_at)",
    ArrayUtil.has(defaultRes.data, (user) => {
      const keys = Object.keys(user ?? {});
      // must include all three required, no more
      return (
        Array.isArray(keys) &&
        keys.length === 3 &&
        keys.includes("id") &&
        keys.includes("email") &&
        keys.includes("created_at")
      );
    }),
  );

  // 3. List users with limit=2 (if >=2 users)
  const limit = 2 as number & tags.Type<"int32">;
  const pagedRes: IPageITodoListUser.ISummary =
    await api.functional.todoList.admin.users.index(connection, {
      body: { limit },
    });
  typia.assert(pagedRes);
  if (pagedRes.data.length > limit) {
    throw new Error("More users returned than limit");
  }

  // 4. Search by email substring (if any user exists)
  if (defaultRes.data.length > 0) {
    const randomUser = RandomGenerator.pick(defaultRes.data);
    const emailFragment = randomUser.email.substring(
      1,
      Math.max(2, randomUser.email.length - 1),
    );
    const filteredRes: IPageITodoListUser.ISummary =
      await api.functional.todoList.admin.users.index(connection, {
        body: { email: emailFragment },
      });
    typia.assert(filteredRes);
    TestValidator.predicate(
      "each user matches filter email fragment",
      filteredRes.data.every((user) => user.email.includes(emailFragment)),
    );
  }

  // 5. Test sort and order params
  const sortFields = ["email", "created_at"] as const;
  const orderDirs = ["asc", "desc"] as const;
  for (const sort of sortFields) {
    for (const order of orderDirs) {
      const sortedRes: IPageITodoListUser.ISummary =
        await api.functional.todoList.admin.users.index(connection, {
          body: { sort, order },
        });
      typia.assert(sortedRes);
      if (sortedRes.data.length > 1) {
        const comp = (a: ITodoListUser.ISummary, b: ITodoListUser.ISummary) => {
          if (sort === "email") {
            return order === "asc"
              ? a.email.localeCompare(b.email)
              : b.email.localeCompare(a.email);
          }
          // sort === "created_at"
          return order === "asc"
            ? a.created_at.localeCompare(b.created_at)
            : b.created_at.localeCompare(a.created_at);
        };
        for (let i = 1; i < sortedRes.data.length; ++i) {
          TestValidator.predicate(
            `users are sorted by ${sort} ${order}`,
            comp(sortedRes.data[i - 1], sortedRes.data[i]) <= 0,
          );
        }
      }
    }
  }

  // 6. Test unauthenticated user (expect error)
  const noAuthConn: api.IConnection = { ...connection, headers: {} };
  await TestValidator.error(
    "unauthenticated user forbidden from user list",
    async () => {
      await api.functional.todoList.admin.users.index(noAuthConn, {
        body: {},
      });
    },
  );
}
