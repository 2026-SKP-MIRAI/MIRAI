# fix: [siw] 중복 이메일 회원가입 시 에러 안내 부재 수정

Issue #266

## 배경
Supabase `auth.signUp()`은 이미 가입된(인증 완료된) 이메일에 대해 error를 반환하지 않고 인증 메일을 재발송한 뒤 성공 응답을 반환한다. `signup/page.tsx`에서 `authError`가 null이면 바로 `setSuccess(true)`를 호출하므로, 기존 계정 사용자도 "이메일을 확인해주세요" 성공 화면을 보게 된다.

## 완료 기준
- [x] 이미 가입된 이메일로 가입 시도 시 성공 화면 대신 에러 메시지("이미 가입된 이메일입니다. 로그인해주세요.")와 로그인 페이지 링크가 표시된다
- [x] 실제 신규 가입자(최초 이메일 가입)에게는 기존과 동일하게 성공 화면이 표시된다
- [x] Google OAuth 가입 경로에는 영향 없다

---

## 코드 리뷰

### 검토 결과
특이사항 없음.

- `data.user?.identities?.length === 0` — Supabase 공식 중복 이메일 감지 패턴으로 안전하다
- 에러 메시지 내 `/login` 링크 삽입 — 조건부 렌더링(`error.includes("이미 가입된")`)으로 다른 에러에 영향 없음
- 테스트: `mockSignUp`에 `data.user.identities` 포함하도록 업데이트

---

## 작업 내역

### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/(auth)/signup/page.tsx` | `signUp` 반환값 `data` 수신, `identities` 길이 0 체크 추가, 에러 메시지에 `/login` 링크 |
| `services/siw/tests/ui/signup.test.tsx` | `mockSignUp` 응답에 `data.user.identities` 포함, 중복 이메일 테스트 케이스 추가 |
| `services/siw/src/app/(auth)/.ai.md` | 중복 이메일 감지 로직 기술 |

### 구현 상세
`signUp()` 응답의 `data.user?.identities` 배열이 비어있으면 이미 가입된 이메일로 판단한다(Supabase 공식 패턴). `authError` 체크 다음 즉시 분기하여 `setSuccess(true)` 호출 전에 차단한다.
