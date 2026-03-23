# [#191] fix: [lww] 소셜 로그인 OAuth 리다이렉트 URL localhost 버그 수정 + 구현체 전체 리뷰 — 구현 계획

> 작성: 2026-03-22

---

## 완료 기준

- [ ] Vercel 환경변수에 `NEXT_PUBLIC_SITE_URL` 올바른 값 설정 (Vercel 도메인)
- [ ] OAuth 콜백 URL이 환경에 따라 동적으로 결정되도록 코드 수정
- [ ] 소셜 로그인 구현체 전체 코드 리뷰 — 추가 버그 탐지 및 수정
  - `src/app/auth/callback/route.ts`
  - `src/app/auth/confirm/route.ts`
  - `src/middleware.ts`
  - `src/components/interview/SaveAccountCTA.tsx`
  - `src/lib/supabase/get-current-user-id.ts`
  - `src/app/(main)/login/page.tsx`
- [ ] Vercel 배포 기준 소셜 로그인 E2E 테스트 통과 (카카오·구글·이메일)

---

## 구현 계획

> Architect + Critic 검토 후 합의된 플랜 (2026-03-22)

### Step 0 — 근본 원인 확인 *(선행 필수)*
- Supabase Auth 대시보드 "Site URL" + "Redirect URLs"가 Vercel 도메인과 일치하는지 확인
- `NEXT_PUBLIC_SITE_URL`은 코드에서 미사용 → `.env.example` 주석을 "Supabase 대시보드 참조용"으로 명확히 변경
- 실제 재현 경로 기록: 어떤 provider에서 발생하는지, Supabase 대시보드 설정 상태

### Step 1 — login/page.tsx 수정 (`src/app/(main)/login/page.tsx`)
- **라인 21 삭제**: `const redirectTo = ...` 렌더 본문에서 계산하는 코드 제거
- `handleKakao`, `handleGoogle` 핸들러 내부에서 각각 `window.location.origin` 기반으로 `redirectTo` 계산
- **라인 61 수정**: `emailRedirectTo`도 동일하게 핸들러 내부 계산으로 이동
- `NEXT_PUBLIC_SITE_URL` fallback 추가하지 않음 (Vercel Preview 도메인 불일치 위험)

### Step 2 — callback/route.ts 쿠키 삭제 추가 (`src/app/auth/callback/route.ts`)
- 마이그레이션 RPC 호출 성공 후 `response.cookies.delete("lww_anon_id")` 추가
- 보안: 재로그인 시 중복 마이그레이션 방지

### Step 3 — confirm/route.ts 익명 마이그레이션 추가 (`src/app/auth/confirm/route.ts`)
- 추가 import: `createServiceClient` (from `@/lib/supabase/server`), `cookies` (from `next/headers`)
- `verifyOtp` 성공 후 `supabase.auth.getUser()` 별도 호출로 user ID 획득 (verifyOtp는 user 직접 반환 안 함)
- `lww_anon_id` 쿠키 읽기 → `migrate_anon_to_user` RPC → 성공 후 쿠키 삭제
- 에러 핸들링: `callback/route.ts` 패턴과 동일 (비치명적 로그, 정상 흐름 유지)

### Step 4 — 구현체 리뷰 (나머지 파일)
- `middleware.ts`: auth redirect 없음 확인, rate limit 로직 정상 동작 확인 ✅ (이미 안전)
- `get-current-user-id.ts`: 에러 시 null 반환, 익명 기능 유지 확인 ✅ (이미 안전)
- `SaveAccountCTA.tsx`: hydration mismatch 없음 확인 ✅ (수정 불필요)

### Step 5 — 테스트 작성
- `callback/route.ts` 기존 테스트에 쿠키 삭제 케이스 추가
- `confirm/route.ts` 신규 유닛 테스트 작성 (기존 `tests/` 패턴 활용):
  - OTP 검증 성공 + 마이그레이션 실행 + 쿠키 삭제
  - OTP 검증 실패 케이스
  - Open Redirect 방어
- E2E: OAuth는 실제 provider 필요 → Vercel Preview 배포 후 수동 검증 체크리스트 (카카오/구글/이메일)

### Step 6 — .ai.md 최신화 (`services/lww/.ai.md`)
