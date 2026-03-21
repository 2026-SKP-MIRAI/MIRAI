# feat: [lww] Phase 1 — 소셜 로그인 (카카오·구글) 구현

## 사용자 관점 목표
취준생이 AI 면접 체험 후 카카오·구글·이메일 계정으로 간편하게 가입해 면접 결과를 영구 저장하고, 이후 재방문 시 히스토리를 이어볼 수 있다.

## 배경
MVP 완료(#116) 후 Phase 1 첫 기능. 현재 비로그인 상태로 면접 완료 시 결과가 로컬에만 저장되어 재방문 시 유실된다. 소셜 로그인으로 "선 체험 후 가입" 루프를 완성하고 D7 리텐션 목표(25%)를 위한 기반을 구축한다.

## 완료 기준
- [x] 카카오·구글 OAuth 로그인/로그아웃 작동 (콜백 처리 포함)
- [x] 이메일 가입/로그인 작동 (이메일 확인 링크 포함)
- [x] 로그인 후 면접 세션이 해당 사용자 계정(`auth.uid()`)에 연결 저장
- [x] 비로그인 상태로 면접 완료 시 "저장하려면 로그인" CTA 표시
- [x] `middleware.ts`에서 Supabase 세션 자동 갱신 처리 (`getUser()`)
- [x] 히스토리 탭(`/interview`)에서 내 면접 세션 목록 표시
- [x] `profiles` 테이블 + RLS 마이그레이션 완료

## 구현 플랜
1. Supabase Dashboard — 카카오·구글 OAuth provider 활성화, redirect URL 등록
2. `middleware.ts` 업데이트 — 기존 rate limiter에 `getUser()` 세션 갱신 병합
3. `/login` 페이지 + `/api/auth/callback` 라우트 생성
4. `profiles` 테이블 + RLS 마이그레이션 (Supabase SQL Editor)
5. 면접 완료 후 비로그인 상태 감지 → "저장하려면 로그인" CTA 컴포넌트 추가
6. 히스토리 탭 — `interview_sessions` 쿼리 시 `user_id = auth.uid()` 필터 적용

## 참고
- Supabase Auth 클라이언트 패턴: `services/lww/src/lib/supabase/server.ts`, `browser.ts` (#100에서 구현 완료)
- seung 서비스 Auth 구현 참고: `services/seung/src/lib/supabase/`
- 환경변수: `KAKAO_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `NEXT_PUBLIC_SITE_URL`

## 개발 체크리스트
- [x] 테스트 코드 포함
- [x] `services/lww/.ai.md` 최신화
- [x] 불변식 위반 없음 (인증은 서비스에서만, 엔진은 무관)

---

## 작업 내역

### 2026-03-22 (구현 완료)

**현황**: 7/7 완료

#### middleware.ts
- rate limiter 전용에서 Supabase `getUser()` 세션 갱신을 병합
- matcher를 API 전용 → 전체 라우트로 확장 (Supabase SSR 공식 권장 패턴)
- **익명 우선 원칙**: 비로그인 사용자 리다이렉트 절대 금지 — getUser() 결과 무시, 갱신만 수행

#### app/auth/callback/route.ts (신규)
- OAuth 코드 교환(`exchangeCodeForSession`) + Open Redirect 방어 (`next` 파라미터 검증)
- `lww_anon_id` 쿠키를 읽어 `migrate_anon_to_user(p_anon_id, p_user_id)` RPC 호출 — 익명 면접 세션을 로그인 계정에 원자적으로 이전

#### app/auth/confirm/route.ts (신규)
- 이메일 확인 링크(`token_hash`) 처리 — `verifyOtp` 후 `safeRedirect`로 이동

#### app/(main)/login/page.tsx (신규)
- 소셜 탭(카카오·구글 OAuth) + 이메일 탭(가입/로그인) 전환 UI
- `?error=oauth`, `?error=invalid_link` 쿼리 파라미터로 에러 배너 표시

#### app/api/interview/start|answer|end/route.ts (수정)
- `getCurrentUserId()` 헬퍼(`lib/supabase/get-current-user-id.ts`)로 로그인 상태 감지
- dual-write: 로그인이면 `user_id = auth.uid()`, 비로그인이면 `user_id = null`
- 인증 오류가 발생해도 익명 기능은 정상 동작 (graceful fallback)

#### components/interview/SaveAccountCTA.tsx (신규)
- 리포트 페이지에서 비로그인 상태 감지 후 "결과를 영구 저장하려면 로그인하세요" 배너 표시
- `/login?next=/report/${sessionId}` 링크로 로그인 후 원래 리포트로 복귀

#### app/(main)/interview/page.tsx (수정)
- Client Component → Server Component 전환
- 로그인: `user_id` 기준 Supabase 쿼리 / 비로그인: `lww_anon_id` 쿠키 + service client로 `anonymous_id` 쿼리
- `toHistory()` 헬퍼로 DB 결과 → `InterviewRecord[]` 변환 (중복 제거)

#### DB 마이그레이션 (Supabase Dashboard 수동 실행)
- `profiles` 테이블 + RLS 정책 (`read own`, `update own`)
- `handle_new_user` 트리거 (`set search_path = public` 필수)
- `migrate_anon_to_user(p_anon_id, p_user_id)` RPC

#### 테스트
- `tests/e2e/auth-flow.spec.ts`: 12/12 pass (로그인 UI, OAuth 에러 처리, Open Redirect 방어, 익명 우선 원칙)
- `tests/e2e/anon-save-cta.spec.ts`: 2/2 pass (면접 완료 → CTA 표시, 직접 접근 → CTA 표시)
- `src/app/api/interview/__tests__/start.test.ts`: 단위 테스트 mock 추가

#### 문서
- `docs/work/active/000179-lww-social-login/migrate.sql`: DB 마이그레이션 전체 SQL
- `docs/work/active/000179-lww-social-login/oauth-setup.md`: 카카오·구글 OAuth 설정 가이드
