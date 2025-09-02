import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListDeletedTodoLog } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListDeletedTodoLog";
import type { IPageITodoListDeletedTodoLog } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListDeletedTodoLog";
import type { IPage } from "@ORGANIZATION/PROJECT-api/lib/structures/IPage";

export async function test_api_deleted_todo_logs_empty_result(
  connection: api.IConnection,
) {
  /**
   * E2E test: User with no deleted todos receives an empty audit log list.
   *
   * 1. Register a new user (unique email + compliant password)
   * 2. Verify the user's email using registration return values
   * 3. Login with that user
   * 4. Exercise the deleted todos log endpoint with no prior todo activity
   * 5. Validate that the logs are empty and pagination is correctly zeroed
   */

  // 1. Register user (establish context)
  const email = typia.random<string & tags.Format<"email">>();
  const password = RandomGenerator.alphaNumeric(12);
  const joinResult = await api.functional.auth.user.join(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(joinResult);
  TestValidator.equals(
    "join: user email matches",
    joinResult.user.email,
    email,
  );
  TestValidator.equals(
    "join: email is not verified",
    joinResult.user.is_email_verified,
    false,
  );

  // 2. Verify email right after registration
  // NOTE: joinResult currently does not contain a separate email verification token; in a real test this would be retrieved via email or from a test fixture
  await api.functional.auth.user.verify_email.verifyEmail(connection, {
    body: {
      user_id: joinResult.user.id,
      token: joinResult.token.access, // Simulated path; replace with verification token if/when available
    } satisfies ITodoListUser.IVerifyEmail,
  });

  // 3. Authenticate (login after verification)
  const loginResult = await api.functional.auth.user.login(connection, {
    body: {
      email,
      password,
    } satisfies ITodoListUser.ILogin,
  });
  typia.assert(loginResult);
  TestValidator.equals(
    "login: same user id returned",
    loginResult.user.id,
    joinResult.user.id,
  );
  TestValidator.equals(
    "login: email is verified",
    loginResult.user.is_email_verified,
    true,
  );

  // 4. Query deleted todos (should be zero)
  const deletedLogsPage =
    await api.functional.todoList.user.todos.deleted.index(connection, {
      body: {} satisfies ITodoListDeletedTodoLog.IRequest,
    });
  typia.assert(deletedLogsPage);
  TestValidator.predicate(
    "deletedLogsPage.data is array (empty or not)",
    Array.isArray(deletedLogsPage.data),
  );
  TestValidator.equals(
    "deletedLog.data is empty",
    deletedLogsPage.data.length,
    0,
  );
  TestValidator.equals(
    "deletedLog.pagination current page is 1",
    deletedLogsPage.pagination.current,
    1,
  );
  TestValidator.equals(
    "deletedLog.records is 0",
    deletedLogsPage.pagination.records,
    0,
  );
  TestValidator.equals(
    "deletedLog.pageCount is 1 for empty result",
    deletedLogsPage.pagination.pages,
    1,
  );
}
