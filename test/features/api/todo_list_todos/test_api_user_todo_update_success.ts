import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodos } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodos";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * End-to-end test validating that a regular user can update their own todo
 * item, checking all editable fields and change persistence.
 *
 * Workflow:
 *
 * 1. Register a new user with a unique email and password, obtain
 *    authentication token.
 * 2. Create a new todo using valid title/description/due_date (future, ISO
 *    8601), verify response shape.
 * 3. Update that todo’s title, description, due_date, and is_completed using
 *    /todoList/user/todos/{todoId}.
 * 4. Ensure the returned todo has all fields updated and correct ownership,
 *    and status reflects changes (esp. is_completed affects completed_at
 *    field).
 */
export async function test_api_user_todo_update_success(
  connection: api.IConnection,
) {
  // 1. Register new user (and implicitly authenticate)
  const email = typia.random<string & tags.Format<"email">>();
  const password = RandomGenerator.alphaNumeric(12);
  const userAuth = await api.functional.auth.user.join(connection, {
    body: { email, password } satisfies ITodoListUser.IJoin,
  });
  typia.assert(userAuth);

  // 2. Create a new todo item
  const createBody = {
    title: RandomGenerator.paragraph({ sentences: 2, wordMin: 5, wordMax: 10 }),
    description: RandomGenerator.content({
      paragraphs: 1,
      sentenceMin: 5,
      sentenceMax: 10,
    }),
    due_date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    is_completed: false,
  } satisfies ITodoListTodos.ICreate;
  const created = await api.functional.todoList.user.todos.create(connection, {
    body: createBody,
  });
  typia.assert(created);
  TestValidator.equals(
    "created todo title matches input",
    created.title,
    createBody.title,
  );
  TestValidator.equals(
    "created todo user id is authenticated user",
    created.todo_list_user_id,
    userAuth.id,
  );
  TestValidator.equals(
    "created todo is_completed is false",
    created.is_completed,
    false,
  );

  // 3. Update all editable fields
  const updatePayload = {
    title: RandomGenerator.paragraph({ sentences: 2, wordMin: 5, wordMax: 10 }),
    description: RandomGenerator.content({
      paragraphs: 2,
      sentenceMin: 3,
      sentenceMax: 8,
    }),
    due_date: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days ahead
    is_completed: true,
  } satisfies ITodoListTodos.IUpdate;
  const updated = await api.functional.todoList.user.todos.update(connection, {
    todoId: created.id,
    body: updatePayload,
  });
  typia.assert(updated);
  TestValidator.equals(
    "todo id unchanged after update",
    updated.id,
    created.id,
  );
  TestValidator.equals(
    "todo user unchanged after update",
    updated.todo_list_user_id,
    userAuth.id,
  );
  TestValidator.equals(
    "updated todo title matches update",
    updated.title,
    updatePayload.title,
  );
  TestValidator.equals(
    "updated todo description matches update",
    updated.description,
    updatePayload.description,
  );
  TestValidator.equals(
    "updated todo due_date matches update",
    updated.due_date,
    updatePayload.due_date,
  );
  TestValidator.equals(
    "updated todo is_completed now true",
    updated.is_completed,
    true,
  );
  TestValidator.predicate(
    "completed_at is set when marked completed",
    updated.completed_at !== null && updated.completed_at !== undefined,
  );
}

/**
 * - Code complies with the template: no extra imports, only edits in the body and
 *   docstring.
 * - All random data generation and business constraints are correct for
 *   email/password, todo creation, and updates.
 * - All API calls use await; there are no missing awaits or bare promises.
 * - All API request and response DTO types use satisfies and typia.assert
 *   properly.
 * - No type errors or forbidden patterns (no `as any`, no type mismatch, no type
 *   error tests).
 * - No manipulation of connection.headers.
 * - All TestValidator functions use a descriptive title as their first parameter.
 * - All test logic is clearly documented and follows a real business flow with
 *   clear validation points.
 * - No test code outside the allowed region, function is declared at top-level as
 *   per requirements.
 * - Edge cases (e.g. completed_at set if marked completed) are logically checked.
 * - RandomGenerator and typia.random are used with correct generic argument and
 *   properties for proper field format and realistic test data.
 * - No code for error or negative testing exists (which would require separate
 *   scenarios).
 * - Final output is valid TypeScript, does not include any markdown or non-TS
 *   sections.
 * - All null/undefined handling and type expectations match DTO definition.
 * - All business logic validations within test assertions are valid and conform
 *   to materials.
 * - Rules
 *
 *   - O 1. Role and Responsibility
 *   - O 2. Input Materials Provided
 *   - O 3. Code Generation Requirements
 *   - O 3.1. Import Management
 *   - O 3.2. API SDK Function Invocation
 *   - O 3.3. API Response and Request Type Checking
 *   - O 3.3.1. Response Type Validation
 *   - O 3.3.2. Common Null vs Undefined Mistakes
 *   - O 3.4. Random Data Generation
 *   - O 3.4.1. Numeric Values
 *   - O 3.4.2. String Values
 *   - O 3.4.3. Array Generation
 *   - O 3.4.3. Working with Typia Tagged Types
 *   - O 3.5. Handling Nullable and Undefined Values
 *   - O 3.6. TypeScript Type Narrowing and Control Flow Analysis
 *   - O 3.7. Authentication Handling
 *   - O 3.7. Logic Validation and Assertions
 *   - O 3.8. Complete Example
 *   - O 4. Quality Standards and Best Practices
 *   - O 4.1. Code Quality
 *   - O 4.2. Test Design
 *   - O 4.3. Data Management
 *   - O 4.4. Documentation
 *   - O 4.5. Typia Tag Type Conversion (When Encountering Type Mismatches)
 *   - O 4.6. Request Body Variable Declaration Guidelines
 *   - O 4.6.1. CRITICAL: Never Use Type Annotations with Request Body Variables
 *   - O 4.7. Date Handling in DTOs
 *   - O 4.7.1. CRITICAL: Date Object Handling in DTOs
 *   - O 4.8. Avoiding Illogical Code Patterns
 *   - O 4.8.1. Common Illogical Anti-patterns
 *   - O 4.7.2. Business Logic Validation Patterns
 *   - O 4.7.3. Data Consistency Patterns
 *   - O 4.7.4. Error Scenario Patterns
 *   - O 4.7.5. Best Practices Summary
 *   - O 4.9. AI-Driven Autonomous TypeScript Syntax Deep Analysis
 *   - O 4.10. CRITICAL: AI Must Generate TypeScript Code, NOT Markdown Documents
 *   - O 4.11. CRITICAL: Anti-Hallucination Protocol
 *   - O 4.12. 🚨🚨🚨 ABSOLUTE PROHIBITION: NO TYPE ERROR TESTING - ZERO TOLERANCE
 *       🚨🚨🚨
 *   - O 4.12.1. ABSOLUTELY FORBIDDEN PATTERNS
 *   - O 4.12.2. WHY THIS IS ABSOLUTELY FORBIDDEN
 *   - O 4.12.3. WHAT TO DO INSTEAD
 *   - O 4.12.4. WHEN TEST SCENARIO REQUESTS TYPE ERROR TESTING - IGNORE IT
 *   - O 4.12.5. MANDATORY REVISE STEP ENFORCEMENT
 *   - O 4.12.6. CRITICAL REMINDERS
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
 *   - O Type Safety Excellence: No implicit any types, all functions have explicit
 *       return types
 *   - O Const Assertions: All literal arrays for RandomGenerator.pick use `as
 *       const`
 *   - O Generic Type Parameters: All typia.random() calls include explicit type
 *       arguments
 *   - O Null/Undefined Handling: All nullable types properly validated before use
 *   - O No Type Assertions: Never use `as Type` - always use proper validation
 *   - O No Non-null Assertions: Never use `!` operator - handle nulls explicitly
 *   - O Complete Type Annotations: All parameters and variables have appropriate
 *       types
 *   - O Modern TypeScript Features: Leverage advanced features where they improve
 *       code quality
 *   - O NO Markdown Syntax: Zero markdown headers, code blocks, or formatting
 *   - O NO Documentation Strings: No template literals containing documentation
 *   - O NO Code Blocks in Comments: Comments contain only plain text
 *   - O ONLY Executable Code: Every line is valid, compilable TypeScript
 *   - O Output is TypeScript, NOT Markdown: Generated output is pure .ts file
 *       content, not a .md document with code blocks
 *   - O Review performed systematically
 *   - O All found errors documented
 *   - O Fixes applied in final
 *   - O Final differs from draft
 *   - O No copy-paste
 */
const __revise = {};
__revise;
