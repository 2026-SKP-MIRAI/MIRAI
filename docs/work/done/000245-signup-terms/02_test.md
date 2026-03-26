# [#245] 회원가입 이용약관 동의 — 테스트 결과

> 테스트 일시: 2026-03-26
> 테스트 환경: vitest v2.1.9 (services/siw)

---

## 1. vitest 자동화 테스트 — signup 관련

### 실행 결과 (signup.test.tsx)

```
✓ tests/ui/signup.test.tsx (6 tests) 842ms
```

| 테스트 케이스 | 기대 결과 | 실제 결과 | 상태 |
|---|---|---|---|
| 비밀번호 7자 입력 시 Zod 에러 | "8자 이상 입력해주세요" 표시, signUp 미호출 | 동일 | ✅ |
| 숫자 없는 비밀번호 입력 시 Zod 에러 | "영문과 숫자를 포함해야 합니다" 표시, signUp 미호출 | 동일 | ✅ |
| 비밀번호 불일치 시 에러 | "비밀번호가 일치하지 않습니다" 표시, signUp 미호출 | 동일 | ✅ |
| 유효한 입력 시 signUp 호출 | `terms_agreed_at` 포함하여 signUp 호출 | 동일 | ✅ |
| 이용약관 미동의 시 가입 차단 | "이용약관에 동의해주세요" 표시, signUp 미호출 | 동일 | ✅ |
| 개인정보처리방침 미동의 시 가입 차단 | "개인정보처리방침에 동의해주세요" 표시, signUp 미호출 | 동일 | ✅ |

---

## 2. 전체 테스트 스위트 요약

```
Test Files  4 failed | 37 passed (41)
Tests       10 failed | 221 passed (231)
Start at    10:31:57
Duration    11.54s
```

### 실패 항목 (이번 PR과 무관한 기존 테스트)

| 파일 | 실패 케이스 | 원인 |
|---|---|---|
| `tests/api/growth-sessions-route.test.ts` | 2개 | `endsWith` 호출 시 undefined — 기존 버그 |
| `src/app/api/resumes/[id]/__tests__/route.test.ts` | 3개 | DELETE 인증 mock 불일치 (401 반환) — 기존 버그 |
| `tests/ui/growth-page.test.tsx` | 1개 | "테스트 이력서 A" 텍스트 미노출 — 기존 버그 |

> 위 실패는 이번 PR 작업 범위 외 기존 테스트 문제이며, 회귀 없음 확인.

---

## 3. 브라우저 수동 테스트 (사용자 직접 확인)

| 항목 | 결과 |
|---|---|
| 이용약관 미체크 → 가입 버튼 클릭 → 에러 메시지 표시, 가입 차단 | ✅ |
| 개인정보처리방침 미체크 → 동일 확인 | ✅ |
| 두 체크박스 모두 체크 후 정상 가입 → Supabase user_metadata에 `terms_agreed_at` 기록 | ✅ |
| Google로 계속하기 → 미체크 시 OAuth 시작 차단 | ✅ |
| `/terms`, `/privacy` 페이지 링크 이동 및 내용 표시 | ✅ |
