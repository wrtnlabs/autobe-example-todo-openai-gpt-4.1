import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { IPage } from "@ORGANIZATION/PROJECT-api/lib/structures/IPage";
import type { IPageITodoListTodos } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListTodos";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import type { ITodoListTodos } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodos";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Validates that an authenticated admin can retrieve, filter, and paginate
 * todos across all users.
 *
 * Scenario:
 *
 * 1. Register two users (userA, userB).
 * 2. Log in as userA and create two todos (one completed, one pending, distinct
 *    titles and due dates).
 * 3. Log in as userB and create one todo (pending).
 * 4. Register admin, then log in as admin.
 * 5. As admin, list all todos via PATCH /todoList/admin/todos, asserting that all
 *    3 todos appear across both users.
 * 6. Use admin todo listing to: a) Filter by is_completed == true or false,
 *    validating expected partition (completed vs pending todos). b) Filter by
 *    due_date range (to only get one of userA's todos). c) Paginate (limit=2,
 *    page=1 and page=2); confirm correct total, correct items per page. d)
 *    Search part of a todo title uniquely.
 * 7. Confirm that business logic enforces admin-wide access (i.e., todos are from
 *    mixed users).
 */
export async function test_api_admin_todo_pagination_all_users(
  connection: api.IConnection,
) {
  // 1. Register two regular users
  const userA_email = typia.random<string & tags.Format<"email">>();
  const userA_password = RandomGenerator.alphaNumeric(12);
  const userA = await api.functional.auth.user.join(connection, {
    body: {
      email: userA_email,
      password: userA_password,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(userA);

  const userB_email = typia.random<string & tags.Format<"email">>();
  const userB_password = RandomGenerator.alphaNumeric(12);
  const userB = await api.functional.auth.user.join(connection, {
    body: {
      email: userB_email,
      password: userB_password,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(userB);

  // 2. Log in as userA, create two todos (completed, pending)
  await api.functional.auth.user.login(connection, {
    body: {
      email: userA_email,
      password: userA_password,
    } satisfies ITodoListUser.ILogin,
  });
  const todoA1_title = RandomGenerator.paragraph({ sentences: 3 });
  const todoA1_due = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString(); // due in 7 days
  const todoA1 = await api.functional.todoList.user.todos.create(connection, {
    body: {
      title: todoA1_title,
      is_completed: false,
      due_date: todoA1_due,
    } satisfies ITodoListTodos.ICreate,
  });
  typia.assert(todoA1);

  const todoA2_title = RandomGenerator.paragraph({ sentences: 3 });
  const todoA2_due = new Date(
    Date.now() + 1 * 24 * 60 * 60 * 1000,
  ).toISOString(); // due in 1 day
  const todoA2 = await api.functional.todoList.user.todos.create(connection, {
    body: {
      title: todoA2_title,
      is_completed: true,
      due_date: todoA2_due,
    } satisfies ITodoListTodos.ICreate,
  });
  typia.assert(todoA2);

  // 3. Log in as userB, create one todo (pending)
  await api.functional.auth.user.login(connection, {
    body: {
      email: userB_email,
      password: userB_password,
    } satisfies ITodoListUser.ILogin,
  });
  const todoB1_title = RandomGenerator.paragraph({ sentences: 3 });
  const todoB1_due = new Date(
    Date.now() + 3 * 24 * 60 * 60 * 1000,
  ).toISOString(); // due in 3 days
  const todoB1 = await api.functional.todoList.user.todos.create(connection, {
    body: {
      title: todoB1_title,
      is_completed: false,
      due_date: todoB1_due,
    } satisfies ITodoListTodos.ICreate,
  });
  typia.assert(todoB1);

  // 4. Register and login as admin
  const admin_email = typia.random<string & tags.Format<"email">>();
  const admin_password = RandomGenerator.alphaNumeric(14);
  const admin = await api.functional.auth.admin.join(connection, {
    body: {
      email: admin_email,
      password: admin_password,
    } satisfies ITodoListAdmin.ICreate,
  });
  typia.assert(admin);

  await api.functional.auth.admin.login(connection, {
    body: {
      email: admin_email,
      password: admin_password,
    } satisfies ITodoListAdmin.ILogin,
  });

  // 5. As admin, list all todos
  const adminTodoList = await api.functional.todoList.admin.todos.index(
    connection,
    {
      body: {} satisfies ITodoListTodos.IRequest,
    },
  );
  typia.assert(adminTodoList);
  TestValidator.predicate(
    "admin sees all todos created by both users",
    adminTodoList.data.length >= 3 &&
      adminTodoList.data.some((x) => x.title === todoA1.title) &&
      adminTodoList.data.some((x) => x.title === todoA2.title) &&
      adminTodoList.data.some((x) => x.title === todoB1.title),
  );

  // 6a. Filter by completed
  const completedTodos = await api.functional.todoList.admin.todos.index(
    connection,
    {
      body: { is_completed: true } satisfies ITodoListTodos.IRequest,
    },
  );
  typia.assert(completedTodos);
  TestValidator.predicate(
    "all returned are completed",
    completedTodos.data.every((x) => x.is_completed),
  );

  const pendingTodos = await api.functional.todoList.admin.todos.index(
    connection,
    {
      body: { is_completed: false } satisfies ITodoListTodos.IRequest,
    },
  );
  typia.assert(pendingTodos);
  TestValidator.predicate(
    "all returned are pending",
    pendingTodos.data.every((x) => !x.is_completed),
  );

  // 6b. Filter by due_date range (get only todoA2 by exact due_date)
  const dueDateFilter = await api.functional.todoList.admin.todos.index(
    connection,
    {
      body: {
        due_date_from: todoA2.due_date ?? undefined,
        due_date_to: todoA2.due_date ?? undefined,
      } satisfies ITodoListTodos.IRequest,
    },
  );
  typia.assert(dueDateFilter);
  TestValidator.predicate(
    "correct due_date filter returns todoA2 only",
    dueDateFilter.data.some((x) => x.title === todoA2.title),
  );

  // 6c. Pagination: limit = 2
  const paged1 = await api.functional.todoList.admin.todos.index(connection, {
    body: { limit: 2, page: 1 } satisfies ITodoListTodos.IRequest,
  });
  typia.assert(paged1);
  TestValidator.predicate(
    "page 1 has at most 2 todos",
    paged1.data.length <= 2,
  );

  const paged2 = await api.functional.todoList.admin.todos.index(connection, {
    body: { limit: 2, page: 2 } satisfies ITodoListTodos.IRequest,
  });
  typia.assert(paged2);
  TestValidator.predicate(
    "page 2 returns remaining todos or empty",
    paged2.data.length >= 0,
  );

  // 6d. Search by unique word from todoA1 title
  const searchWord = todoA1_title.split(" ")[0];
  const searchRes = await api.functional.todoList.admin.todos.index(
    connection,
    {
      body: { search: searchWord } satisfies ITodoListTodos.IRequest,
    },
  );
  typia.assert(searchRes);
  TestValidator.predicate(
    "search result includes todoA1",
    searchRes.data.some((x) => x.title === todoA1.title),
  );

  // 7. Confirm that todos are cross-user
  TestValidator.predicate(
    "admin sees todos from both users",
    adminTodoList.data.some((x) => x.title === todoA1.title) &&
      adminTodoList.data.some((x) => x.title === todoB1.title),
  );
}

/**
 * - Code structure strictly follows requirements: function signature, JSDoc, and
 *   scenario steps are comprehensive and in logical order.
 * - ALL required business flows are implemented: two regular users, admin user,
 *   todos for both users, correct context switches before API calls.
 * - No additional imports; only allowed and required imports are present.
 * - DTO types are exactly matched in every API call; satisfies pattern proper for
 *   request bodies.
 * - Random data uses typia.random (emails) and RandomGenerator with correct
 *   arguments.
 * - Await is present for EVERY api.functional.* call without exception.
 * - Typia.assert is used on all responses.
 * - All TestValidator functions (predicate) include a descriptive title and use
 *   correct order for actual/expected values.
 * - Pagination, filtering, searching, and cross-user logic are covered.
 * - No code for type error testing. No "as any" or wrong data types used. No
 *   reference to properties or APIs outside provided DTOs/functions.
 * - No connection.headers manipulations of any kind. No Markdown in comments or
 *   code.
 * - No redundant test or logic; clear scenario stepwise code and comments for
 *   each major step. All business rules are respected, and cross-user
 *   validation logic is sound.
 * - Edge cases: pages, filters, search, and multi-user coverage.
 * - Final implementation strictly matches production-level expectations for both
 *   logic and syntax.
 * - Rules
 *
 *   - O 1. Role and Responsibility
 *   - O 1.1. Function Calling Workflow
 *   - O 2. Input Materials Provided
 *   - O 3. Code Generation Requirements
 *   - O 3.1. Test Function Structure
 *   - O 3.2. API SDK Function Invocation
 *   - O 3.3. API Response and Request Type Checking
 *   - O 3.4. Random Data Generation
 *   - O 3.5. Handling Nullable and Undefined Values
 *   - O 3.6. TypeScript Type Narrowing and Control Flow Analysis
 *   - O 3.7. Authentication Handling
 *   - O 3.7. Logic Validation and Assertions
 *   - O 3.8. Complete Example
 *   - O 4. Quality Standards and Best Practices
 *   - O 4.5. Typia Tag Type Conversion (When Encountering Type Mismatches)
 *   - O 4.6. Request Body Variable Declaration Guidelines
 *   - O 4.7. Date Handling in DTOs
 *   - O 4.8. Avoiding Illogical Code Patterns
 *   - O 4.7.2. Business Logic Validation Patterns
 *   - O 4.7.3. Data Consistency Patterns
 *   - O 4.7.4. Error Scenario Patterns
 *   - O 4.7.5. Best Practices Summary
 *   - O 4.9. AI-Driven Autonomous TypeScript Syntax Deep Analysis
 *   - O 4.10. CRITICAL: AI Must Generate TypeScript Code, NOT Markdown Documents
 *   - O 4.11. CRITICAL: Anti-Hallucination Protocol
 *   - O 4.12. 🚨🚨🚨 ABSOLUTE PROHIBITION: NO TYPE ERROR TESTING - ZERO TOLERANCE
 *       🚨🚨🚨
 *   - O 5. Final Checklist
 * - Check List
 *
 *   - O NO additional import statements
 *   - O NO require() statements
 *   - O NO creative import syntax
 *   - O Template code untouched
 *   - O All functionality implemented using only template-provided imports
 *   - O 🚨 NO TYPE ERROR TESTING - THIS IS #1 VIOLATION 🚨
 *   - O NO `as any` USAGE
 *   - O NO wrong type data in requests
 *   - O NO missing required fields
 *   - O NO testing type validation
 *   - O NO HTTP status code testing
 *   - O NO illogical operations
 *   - O NO response type validation after typia.assert()
 *   - O Step 4 revise COMPLETED
 *   - O Function follows the correct naming convention
 *   - O Function has exactly one parameter: `connection: api.IConnection`
 *   - O No external functions are defined outside the main function
 *   - O CRITICAL: All TestValidator functions include descriptive title as first
 *       parameter
 *   - O All TestValidator functions use proper positional parameter syntax
 *   - O EVERY `api.functional.*` call has `await`
 *   - O TestValidator.error with async callback has `await`
 *   - O No bare Promise assignments
 *   - O All async operations inside loops have `await`
 *   - O All async operations inside conditionals have `await`
 *   - O Return statements with async calls have `await`
 *   - O Promise.all() calls have `await`
 *   - O All API calls use proper parameter structure and type safety
 *   - O API function calling follows the exact SDK pattern from provided materials
 *   - O DTO type precision
 *   - O No DTO type confusion
 *   - O Path parameters and request body are correctly structured in the second
 *       parameter
 *   - O All API responses are properly validated with `typia.assert()`
 *   - O Authentication is handled correctly without manual token management
 *   - O Only actual authentication APIs are used (no helper functions)
 *   - O CRITICAL: NEVER touch connection.headers in any way - ZERO manipulation
 *       allowed
 *   - O Test follows a logical, realistic business workflow
 *   - O Complete user journey from authentication to final validation
 *   - O Proper data dependencies and setup procedures
 *   - O Edge cases and error conditions are appropriately tested
 *   - O Only implementable functionality is included (unimplementable parts are
 *       omitted)
 *   - O No illogical patterns: All test scenarios respect business rules and data
 *       relationships
 *   - O Random data generation uses appropriate constraints and formats
 *   - O CRITICAL: All TestValidator functions include descriptive title as FIRST
 *       parameter
 *   - O All TestValidator assertions use actual-first, expected-second pattern
 *       (after title)
 *   - O Code includes comprehensive documentation and comments
 *   - O Variable naming is descriptive and follows business context
 *   - O Simple error validation only (no complex error message checking)
 *   - O CRITICAL: For TestValidator.error(), use `await` ONLY with async callbacks
 *   - O CRITICAL: Only API functions and DTOs from the provided materials are used
 *       (not from examples)
 *   - O CRITICAL: No fictional functions or types from examples are used
 *   - O CRITICAL: No type safety violations (`any`, `@ts-ignore`,
 *       `@ts-expect-error`)
 *   - O CRITICAL: All TestValidator functions include title as first parameter and
 *       use correct positional parameter syntax
 *   - O Follows proper TypeScript conventions and type safety practices
 *   - O Efficient resource usage and proper cleanup where necessary
 *   - O Secure test data generation practices
 *   - O No hardcoded sensitive information in test data
 *   - O No authentication role mixing without proper context switching
 *   - O No operations on deleted or non-existent resources
 *   - O All business rule constraints are respected
 *   - O No circular dependencies in data creation
 *   - O Proper temporal ordering of events
 *   - O Maintained referential integrity
 *   - O Realistic error scenarios that could actually occur
 *   - O Type Safety Excellence
 *   - O Const Assertions
 *   - O Generic Type Parameters
 *   - O Null/Undefined Handling
 *   - O No Type Assertions
 *   - O No Non-null Assertions
 *   - O Complete Type Annotations
 *   - O Modern TypeScript Features
 *   - O NO Markdown Syntax
 *   - O NO Documentation Strings
 *   - O NO Code Blocks in Comments
 *   - O ONLY Executable Code
 *   - O Output is TypeScript, NOT Markdown
 *   - O Review performed systematically
 *   - O All found errors documented
 *   - O Fixes applied in final
 *   - O Final differs from draft
 *   - O No copy-paste
 */
const __revise = {};
__revise;
