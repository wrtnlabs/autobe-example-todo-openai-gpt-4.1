import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";
import type { IPage } from "@ORGANIZATION/PROJECT-api/lib/structures/IPage";
import type { IPageITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/IPageITodoListTodo";
import type { ITodoListAdmin } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListAdmin";
import type { ITodoListTodo } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListTodo";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";

/**
 * 관리자 권한으로 admin todos 목록 검색/필터링 접근 실동 검증
 *
 * 1. 관리자로 회원가입/로그인
 * 2. User 2명 가입 후 각각 로그인/각자 여러 todo 생성
 * 3. Admin 컨텍스트로 전환 후 PATCH /todoList/admin/todos 다양한 필터로 접근 검증
 * 4. 필터 결과가 각 조건대로 정확히 반영 -> 특정 user의 todo만/전체 크로스 검색/빈 결과/잘못된 페이지 등
 * 5. User context/미인증 context서 접근 시 권한거부
 */
export async function test_api_admin_todo_list_access_filtering(
  connection: api.IConnection,
) {
  // 1. 관리자로 회원가입
  const adminEmail = typia.random<string & tags.Format<"email">>();
  const adminPw = RandomGenerator.alphaNumeric(10);
  const adminJoin = await api.functional.auth.admin.join(connection, {
    body: {
      email: adminEmail,
      password_hash: adminPw,
      name: RandomGenerator.name(),
      avatar_uri: null,
      // status, privilege_level optional
    } satisfies ITodoListAdmin.IJoin,
  });
  typia.assert(adminJoin);

  // 2. user1, user2 가입/로그인/할일 생성
  const users: { email: string; pw: string; todos: ITodoListTodo[] }[] = [];
  for (let i = 0; i < 2; ++i) {
    const userEmail = typia.random<string & tags.Format<"email">>();
    const userPw = RandomGenerator.alphaNumeric(10);
    const userJoin = await api.functional.auth.user.join(connection, {
      body: {
        email: userEmail,
        password: userPw,
        name: RandomGenerator.name(),
        avatar_uri: null,
      } satisfies ITodoListUser.IJoin,
    });
    typia.assert(userJoin);
    // 로그인하여 토큰 갱신
    const userLogin = await api.functional.auth.user.login(connection, {
      body: {
        email: userEmail,
        password: userPw,
      } satisfies ITodoListUser.ILogin,
    });
    typia.assert(userLogin);
    // 각자 여러 todo 생성 (완료/미완료/마감일 지정 등 혼합)
    const todos: ITodoListTodo[] = [];
    for (let t = 0; t < 3; ++t) {
      const todo = await api.functional.todoList.user.todos.create(connection, {
        body: {
          content: RandomGenerator.paragraph({ sentences: 4 }),
          due_date:
            t % 2 === 0
              ? new Date(Date.now() + (t + 1) * 86400_000).toISOString()
              : undefined,
        } satisfies ITodoListTodo.ICreate,
      });
      typia.assert(todo);
      todos.push(todo);
    }
    users.push({ email: userEmail, pw: userPw, todos });
  }

  // 3. admin으로 다시 로그인 (context 전환)
  await api.functional.auth.admin.login(connection, {
    body: {
      email: adminEmail,
      password: adminPw,
    } satisfies ITodoListAdmin.ILogin,
  });

  // 4. admin todo 검색: 전체(TODO), content 필터(키워드), 완료/미완료, due_date 등
  // 전체 검색
  const resAll = await api.functional.todoList.admin.todos.index(connection, {
    body: {},
  });
  typia.assert(resAll);
  // 모든 user의 todos가 포함되는지
  for (const u of users) {
    for (const expected of u.todos) {
      TestValidator.predicate(
        `모든 사용자 todo 포함(ID=${expected.id})`,
        resAll.data.some((todo) => todo.id === expected.id),
      );
    }
  }
  // content 부분 일치 검색 (부분문자열, 대소문자 무관)
  for (const u of users) {
    const searched = await api.functional.todoList.admin.todos.index(
      connection,
      {
        body: { search: RandomGenerator.substring(u.todos[0].content) },
      },
    );
    typia.assert(searched);
    TestValidator.predicate(
      `content 부분검색 결과 포함(ID=${u.todos[0].id})`,
      searched.data.some((todo) => todo.id === u.todos[0].id),
    );
  }
  // completed 별 검색
  for (const completed of [false, true]) {
    // 마킹 - 한 user의 todo를 임의로 완료
    const u = users[0];
    const todo = u.todos[0];
    if (!todo.completed && completed) {
      // 인위적으로 완성상태 처리는 따로 제공 API가 없으므로 skip
      continue;
    }
    const result = await api.functional.todoList.admin.todos.index(connection, {
      body: { completed },
    });
    typia.assert(result);
    for (const d of result.data) {
      TestValidator.equals(
        `completed=${completed}인 모든 todo`,
        d.completed,
        completed,
      );
    }
  }
  // due_date(마감일만 필터) 검색
  {
    // user2의 두번째 todo의 due_date로 필터
    const filterDate = users[1].todos[1].due_date;
    if (filterDate) {
      const dueFiltered = await api.functional.todoList.admin.todos.index(
        connection,
        {
          body: { due_date: filterDate },
        },
      );
      typia.assert(dueFiltered);
      for (const d of dueFiltered.data) {
        TestValidator.equals(`due_date 일치 todo`, d.due_date, filterDate);
      }
    }
  }

  // 페이지네이션/page/limit
  const totalCount = users[0].todos.length + users[1].todos.length;
  {
    const onePage = await api.functional.todoList.admin.todos.index(
      connection,
      {
        body: { limit: 1 },
      },
    );
    typia.assert(onePage);
    TestValidator.equals("limit=1에서는 한 건만 반환", onePage.data.length, 1);
    const secondPage = await api.functional.todoList.admin.todos.index(
      connection,
      {
        body: { page: 2, limit: 1 },
      },
    );
    typia.assert(secondPage);
    TestValidator.equals("2페이지에서 한 건 반환", secondPage.data.length, 1);
  }
  // 잘못된 page/limit(음수/0/null 등)에 대해 빈 결과/예외처리 (여기선 빈 결과만 확인)
  for (const page of [-1, 0]) {
    const invalid = await api.functional.todoList.admin.todos.index(
      connection,
      {
        body: { page: page satisfies number as number },
      },
    );
    typia.assert(invalid);
    TestValidator.equals(`페이지값 ${page}은 빈 목록`, invalid.data.length, 0);
  }
  {
    const noMatch = await api.functional.todoList.admin.todos.index(
      connection,
      {
        body: { search: "nonexistentkeyword" },
      },
    );
    typia.assert(noMatch);
    TestValidator.equals("일치하는 todo 없음", noMatch.data.length, 0);
  }
  // 5. 일반 user나 미로그인 context 접근 시 권한 거부
  // user1로 로그인+access
  await api.functional.auth.user.login(connection, {
    body: {
      email: users[0].email,
      password: users[0].pw,
    } satisfies ITodoListUser.ILogin,
  });
  await TestValidator.error("user 권한으로 admin todos 접근 금지", async () => {
    await api.functional.todoList.admin.todos.index(connection, { body: {} });
  });
  // 미인증 context: header 제거
  const unauthConn: api.IConnection = { ...connection, headers: {} };
  await TestValidator.error("미인증시 admin todos 접근 금지", async () => {
    await api.functional.todoList.admin.todos.index(unauthConn, { body: {} });
  });
}
