# fix: [lww] 소셜 로그인 OAuth 리다이렉트 URL localhost 버그 수정 + 구현체 전체 리뷰

## 사용자 관점 목표
Vercel 배포 환경에서 소셜 로그인 후 정상적으로 서비스 화면으로 돌아온다.

## 배경
PR #190에서 소셜 로그인(카카오·구글·이메일)을 구현했으나, Vercel 환경에서 OAuth 콜백 후 `localhost:3000`으로 리다이렉트되는 버그 발견. `NEXT_PUBLIC_SITE_URL`이 `localhost:3000`으로 설정된 것이 원인으로 추정. 추가 버그도 있을 수 있어 구현체 전체 리뷰 필요.

## 완료 기준
- [ ] Vercel 환경변수에 `NEXT_PUBLIC_SITE_URL` 올바른 값 설정 (Vercel 도메인) ← 수동 작업 필요
- [x] OAuth 콜백 URL이 환경에 따라 동적으로 결정되도록 코드 수정
- [x] 소셜 로그인 구현체 전체 코드 리뷰 — 추가 버그 탐지 및 수정
  - `src/app/auth/callback/route.ts` — 마이그레이션 후 lww_anon_id 쿠키 삭제 추가
  - `src/app/auth/confirm/route.ts` — 익명→인증 마이그레이션 추가 (이메일 확인 경로 누락 수정)
  - `src/middleware.ts` — 안전 확인 ✅ 수정 불필요
  - `src/components/interview/SaveAccountCTA.tsx` — hydration 안전 확인 ✅ 수정 불필요
  - `src/lib/supabase/get-current-user-id.ts` — 에러 핸들링 정상 확인 ✅ 수정 불필요
  - `src/app/(main)/login/page.tsx` — redirectTo/emailRedirectTo 핸들러 내부로 이동
- [ ] Vercel 배포 기준 소셜 로그인 E2E 테스트 통과 (카카오·구글·이메일) ← Vercel 배포 후 수동 검증 필요

## 구현 플랜
1. `NEXT_PUBLIC_SITE_URL` Vercel 환경변수 설정 확인 및 코드에서 동적 처리
2. 소셜 로그인 구현체 전체 파일 코드 리뷰 — 버그 탐지
3. 발견된 버그 수정
4. Vercel 배포 후 E2E 재검증

## 참고
- PR #190: feat: [lww] Phase 1 소셜 로그인 (카카오·구글·이메일) + 익명→인증 마이그레이션
- 재현: Vercel 배포 환경에서 소셜 가입 시 `localhost:3000`으로 리다이렉트

## 개발 체크리스트
- [x] 테스트 코드 포함 (callback 7 + confirm 9, 총 16개)
- [x] `services/lww/.ai.md` 최신화
- [x] 불변식 위반 없음

---

## 작업 내역

### 2026-03-22

**현황**: 2/4 AC 완료 (나머지 2개는 Vercel 수동 작업 필요)

**완료된 항목**:
- OAuth 콜백 URL 동적 결정 코드 수정 (`login/page.tsx` redirectTo/emailRedirectTo 핸들러 내부로 이동)
- 소셜 로그인 구현체 전체 코드 리뷰 및 버그 수정:
  - `callback/route.ts`: 마이그레이션 후 `lww_anon_id` 쿠키 삭제 추가 (보안 강화)
  - `confirm/route.ts`: 이메일 OTP 확인 후 익명→인증 마이그레이션 추가 (누락 기능)
  - 나머지 파일(middleware, SaveAccountCTA, get-current-user-id): 안전 확인, 수정 불필요

**미완료 항목**:
- Vercel 환경변수 NEXT_PUBLIC_SITE_URL 설정 (Supabase 대시보드 Site URL + Redirect URLs 설정도 확인 필요)
- E2E 테스트 통과 (Vercel 배포 후 카카오/구글/이메일 수동 검증)

**변경 파일**: 6개 (login/page.tsx, callback/route.ts, confirm/route.ts, .env.example, .ai.md, 테스트 2개 신규/수정)

**테스트**: 16/16 통과 (callback 7 + confirm 9)

