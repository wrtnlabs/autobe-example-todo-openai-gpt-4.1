import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";

export async function test_api_user_join_success_and_email_verification_required(
  connection: api.IConnection,
) {
  /**
   * 1. 신규 사용자가 고유하고 형식이 올바른 이메일 + 강한 비밀번호로 가입 요청 시 성공적으로 계정이 생성되고, 응답에는
   *    is_email_verified가 false로 반환되는지 검증한다.
   * 2. 응답에 password_hash 등 민감 정보가 노출되지 않는지 확인한다.
   * 3. 가입 요청 후 해당 이메일로 로그인 시도 시, 이메일 인증 전에는 로그인 불가능(실패)해야 함을 에러 테스트로 확인해야 한다.(단,
   *    로그인 API가 미제공이므로 실제 호출 불가 - 주석 처리)
   * 4. 이메일 중복, 비밀번호 약함, 이메일 형식 불일치 등 서비스 입력 규칙 위반 시도에 대해 각각 적절한 에러가 반환되는지 테스트.
   */

  // 1. 정상적인 정보로 회원가입 요청
  const joinInput: ITodoListUser.IJoin = {
    email: typia.random<string & tags.Format<"email">>(),
    password: RandomGenerator.alphaNumeric(12),
  };
  const joinResponse: ITodoListUser.IAuthorized =
    await api.functional.auth.user.join(connection, {
      body: joinInput,
    });
  typia.assert(joinResponse); // 타입 체크
  // 2. is_email_verified가 false로 반환되는지 확인
  TestValidator.equals(
    "이메일 인증 전 가입자는 is_email_verified가 false임",
    joinResponse.user.is_email_verified,
    false,
  );
  // 3. 응답 객체에 password_hash 등 민감 정보가 포함되지 않는지 확인
  TestValidator.predicate(
    "응답 객체에 password_hash 미포함",
    !("password_hash" in joinResponse.user),
  );

  // 4. 동일 이메일로 중복 가입 시도 → 실패해야 함
  await TestValidator.error(
    "이미 가입된 이메일로 재가입 시도시 실패",
    async () => {
      await api.functional.auth.user.join(connection, {
        body: { ...joinInput },
      });
    },
  );

  // 5. 약한 비밀번호(8자 미만)로 회원가입 시도 → 실패해야 함
  await TestValidator.error(
    "비밀번호 8자 미만 가입은 거부되어야 함",
    async () => {
      await api.functional.auth.user.join(connection, {
        body: {
          email: typia.random<string & tags.Format<"email">>(),
          password: RandomGenerator.alphaNumeric(6),
        } satisfies ITodoListUser.IJoin,
      });
    },
  );

  // 6. 잘못된 이메일 형식(명백한 오타)으로 회원가입 시도 → 실패해야 함
  await TestValidator.error(
    "잘못된 이메일 형식 가입 시도 실패 확인",
    async () => {
      await api.functional.auth.user.join(connection, {
        body: {
          email: "not-an-email",
          password: RandomGenerator.alphaNumeric(12),
        } as any, // 컴파일러 통과용, 실운영 환경에서는 validation 오류로 리턴 기대
      });
    },
  );

  // 7. 이메일 인증 전 로그인 불가 여부 (로그인 API 미 제공이라 주석처리)
  // await TestValidator.error("이메일 인증 전 로그인 불가", async () => {
  //   await api.functional.auth.user.login(connection, {
  //     body: {
  //       email: joinInput.email,
  //       password: joinInput.password,
  //     },
  //   });
  // });
}
