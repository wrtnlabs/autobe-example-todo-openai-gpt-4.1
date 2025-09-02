import { ArrayUtil, RandomGenerator, TestValidator } from "@nestia/e2e";
import { IConnection } from "@nestia/fetcher";
import typia, { tags } from "typia";

import api from "@ORGANIZATION/PROJECT-api";
import type { ITodoListUser } from "@ORGANIZATION/PROJECT-api/lib/structures/ITodoListUser";
import type { IAuthorizationToken } from "@ORGANIZATION/PROJECT-api/lib/structures/IAuthorizationToken";

/**
 * 만료되었거나 잘못된 reset token으로 비밀번호 변경을 시도할 때의 방어적 로직과 API 오류 응답을 검증한다.
 *
 * - 회원가입 및 이메일 인증 정상적으로 거친 후, 실제로 발급된 적 없는 가짜(password reset) 토큰으로 비밀번호 변경을
 *   시도해야 한다.
 * - /auth/user/reset-password 엔드포인트는 반드시 success: false, error 메시지(non-null)
 *   를 반환해야 하며, 사용자 실제 패스워드 및 세션에 대한 변화가 없어야 한다(단, 실제 비밀번호와 세션 상태까지 확인하는
 *   API는 제공되지 않아 에러응답 위주로 확인).
 * - 정상 토큰으로 비밀번호 변경되는 흐름과 구분하여, 오로지 실패 및 방어 로직이 작동되는지, 그리고 상세 에러메시지 혹은 실패
 *   플래그가 명확히 오는지만 체크한다.
 */
export async function test_api_user_reset_password_invalid_token(
  connection: api.IConnection,
) {
  // 1. 신규 유저 회원가입
  const userEmail: string = typia.random<string & tags.Format<"email">>();
  const userPassword: string = RandomGenerator.alphaNumeric(12);
  const joinOutput = await api.functional.auth.user.join(connection, {
    body: {
      email: userEmail,
      password: userPassword,
    } satisfies ITodoListUser.IJoin,
  });
  typia.assert(joinOutput);

  // 2. 이메일 인증 과정을 거쳤다고 간주
  // (실제로는 이메일 인증 토큰 발급/확인 API 미제공이므로, 가입 직후 인증 처리된 상태로 진행)

  // 3. 유효하지 않은(실제 발급 이력 없는) 패스워드 reset 토큰으로 패스워드 변경 시도
  const invalidResetToken: string = RandomGenerator.alphaNumeric(32);
  const resetPasswordResult =
    await api.functional.auth.user.reset_password.resetPassword(connection, {
      body: {
        token: invalidResetToken,
        user_id: joinOutput.user.id,
        new_password: RandomGenerator.alphaNumeric(16),
      } satisfies ITodoListUser.IResetPassword,
    });
  typia.assert(resetPasswordResult);

  TestValidator.predicate(
    "invalid token으로 password reset 시도시 반드시 success: false 응답이어야 한다.",
    resetPasswordResult.success === false,
  );
  TestValidator.predicate(
    "에러 메시지는 반드시 존재하거나 non-null이어야 한다.",
    resetPasswordResult.error !== null &&
      resetPasswordResult.error !== undefined &&
      resetPasswordResult.error.length > 0,
  );
}
