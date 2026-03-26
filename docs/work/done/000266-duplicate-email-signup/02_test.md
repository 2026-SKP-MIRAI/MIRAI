# 테스트 결과 — #266

## 테스트 환경
- vitest (services/siw)
- 테스트 실행일: 2026-03-26

## 단위 테스트
| 파일 | 케이스 | 결과 |
|------|--------|------|
| tests/ui/signup.test.tsx | 비밀번호 7자 입력 시 Zod 에러 | ✅ PASS |
| tests/ui/signup.test.tsx | 숫자 없는 비밀번호 입력 시 Zod 에러 | ✅ PASS |
| tests/ui/signup.test.tsx | 비밀번호 불일치 시 에러 | ✅ PASS |
| tests/ui/signup.test.tsx | 유효한 입력 시 signUp 호출 후 성공 화면 표시 | ✅ PASS |
| tests/ui/signup.test.tsx | 이미 가입된 이메일로 가입 시도 시 에러 메시지와 로그인 링크 표시 | ✅ PASS |
| tests/ui/signup.test.tsx | 이미 가입된 이메일로 가입 시도 시 성공 화면이 표시되지 않는다 | ✅ PASS |
| tests/ui/signup.test.tsx | 이용약관 미동의 시 가입 차단 | ✅ PASS |
| tests/ui/signup.test.tsx | 개인정보처리방침 미동의 시 가입 차단 | ✅ PASS |

## 통합/수동 검증
- [x] 이미 가입된 이메일로 가입 시도 시 성공 화면 대신 에러 메시지("이미 가입된 이메일입니다. 로그인해주세요.")와 로그인 페이지 링크가 표시된다: `data.user?.identities` 배열이 비어있으면 에러 메시지 렌더링, `/login` 링크 포함
- [x] 실제 신규 가입자(최초 이메일 가입)에게는 기존과 동일하게 성공 화면이 표시된다: identities 비어있지 않을 때 성공 화면 표시 확인
- [x] Google OAuth 가입 경로에는 영향 없다: signUp 응답 경로에서만 검사, OAuth 흐름 미변경

## 테스트 커버리지
신규 추가 테스트: 2개 (이미 가입된 이메일 에러 메시지 + 성공 화면 미표시)
