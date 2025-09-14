import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { ITodoListTodos } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodos";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * Test that a user can retrieve their own todo item by ID, and that the
 * returned fields match exactly what was created (ownership enforced, all
 * fields present, system fields populated correctly).
 *
 * Steps:
 *
 * 1. Register a new user with unique email and password.
 * 2. Create a todo item with random valid data as this user.
 * 3. Retrieve the todo item by ID with GET /todoList/user/todos/{todoId}.
 * 4. Confirm all expected fields match between created and retrieved todo,
 *    including system fields (ownership, timestamps, etc).
 */
export async function test_api_todo_item_retrieve_by_owner(
  connection: api.IConnection,
) {
  // 1. Register a new user
  const email: string = typia.random<string & tags.Format<"email">>();
  const password: string = RandomGenerator.alphaNumeric(12);
  const registration: ITodoListUser.IAuthorized =
    await api.functional.auth.user.join(connection, {
      body: {
        email,
        password,
      } satisfies ITodoListUser.IJoin,
    });
  typia.assert(registration);

  // 2. Create a todo item as this user
  const todoInput = {
    title: RandomGenerator.paragraph({ sentences: 3, wordMin: 4, wordMax: 10 }),
    description: RandomGenerator.content({
      paragraphs: 1,
      sentenceMin: 5,
      sentenceMax: 10,
      wordMin: 3,
      wordMax: 8,
    }),
    due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
    is_completed: false,
  } satisfies ITodoListTodos.ICreate;
  const created: ITodoListTodos =
    await api.functional.todoList.user.todos.create(connection, {
      body: todoInput,
    });
  typia.assert(created);

  // 3. Retrieve this todo item by ID
  const retrieved: ITodoListTodos = await api.functional.todoList.user.todos.at(
    connection,
    { todoId: created.id },
  );
  typia.assert(retrieved);

  // 4. Validate all relevant fields match (business fields, system ownership, timestamps)
  TestValidator.equals("id", retrieved.id, created.id);
  TestValidator.equals(
    "owner user id",
    retrieved.todo_list_user_id,
    registration.id,
  );
  TestValidator.equals("title", retrieved.title, todoInput.title);
  TestValidator.equals(
    "description",
    retrieved.description,
    todoInput.description,
  );
  TestValidator.equals("due_date", retrieved.due_date, todoInput.due_date);
  TestValidator.equals(
    "is_completed",
    retrieved.is_completed,
    todoInput.is_completed,
  );
  TestValidator.predicate(
    "created_at exists",
    typeof retrieved.created_at === "string" &&
      retrieved.created_at.length >= 10,
  );
  TestValidator.predicate(
    "updated_at exists",
    typeof retrieved.updated_at === "string" &&
      retrieved.updated_at.length >= 10,
  );
  TestValidator.equals(
    "completed_at should be null (not completed)",
    retrieved.completed_at,
    null,
  );
}

/**
 * 1. All steps are clearly documented and follow the business scenario.
 * 2. Every API function call includes await. No missing awaits.
 * 3. Uses only allowed template imports, no external or extra imports.
 * 4. Email and password generation follow type constraints.
 * 5. Request body for todo creation includes title, description, due_date,
 *    is_completed using only properties from ITodoListTodos.ICreate.
 * 6. System fields and business fields are validated.
 * 7. Nullable/completed_at validated correctly with null.
 * 8. No prohibited type errors, no use of 'as any', no type assertions.
 * 9. All TestValidator calls include descriptive title as first parameter and
 *    correct argument order.
 * 10. All DTO property names are checked against source types: ownership,
 *     timestamp, completion etc.
 * 11. Proper null/undefined handling – never using undefined or omitting fields
 *     that can be null.
 * 12. Final function uses only schema-allowed fields and proper business context.
 * 13. No status code or error message assertions present – only business value
 *     assertions.
 * 14. No fictional functions used, only factual API usage.
 * 15. Non-null assertion and typia.assert are correctly used on all nullable values
 *     before property access.
 *
 * No violations or errors found. This matches all requirements perfectly.
 *
 * - Rules
 *
 *   - O 1. Role and Responsibility
 *   - O 2. Input Materials Provided
 *   - O 3. Code Generation Requirements
 *   - O 3.1. Import Management
 *   - O 3.2. API SDK Function Invocation
 *   - O 3.3. API Response and Request Type Checking
 *   - O 3.4. Random Data Generation
 *   - O 3.5. Handling Nullable and Undefined Values
 *   - O 3.6. TypeScript Type Narrowing and Control Flow Analysis
 *   - O 3.7. Authentication Handling
 *   - O 3.7. Logic Validation and Assertions
 *   - O 3.8. Complete Example
 *   - O 4. Quality Standards and Best Practices
 *   - O 5. Final Checklist
 * - Check List
 *
 *   - O NO additional import statements
 *   - O NO require() statements
 *   - O NO wrong type data in requests
 *   - O NO missing required fields
 *   - O PROPER async/await usage on all API calls
 *   - O EVERY TestValidator includes descriptive title as first parameter
 *   - O ALL api.functional.* calls have await
 *   - O Proper DTO variant usage for requests/responses
 *   - O TypeScript compiles successfully
 *   - O All code fits the provided template, no outside definitions
 */
const __revise = {};
__revise;
