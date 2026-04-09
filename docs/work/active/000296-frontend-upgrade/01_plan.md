# [#296] [kwan] 프론트엔드 고도화 — 랜딩 + 인증 + 대시보드 + 시각화 — 구현 계획

> 작성: 2026-03-27

---

## 완료 기준

- [ ] globals.css에 MirAI 디자인 시스템 적용 (Pretendard, glass-card, gradient-text, btn-primary 등)
- [ ] 랜딩 페이지(`/`) 구현 — Hero, Features, Personas, Evaluation, CTA, Footer
- [ ] 기존 업로드 폼 `/upload`으로 이동 + 라우팅 정리
- [ ] Supabase Auth 연동 — 로그인/회원가입/콜백/미들웨어
- [ ] DB 마이그레이션 — Resume, InterviewSession, Report에 `userId` + `fileName` 추가
- [ ] 전체 API 라우트 인증 게이트 추가 (userId 기반 필터링)
- [ ] 대시보드(`/dashboard`) — 이력서 목록, 성장 추이 차트, 삭제 기능
- [ ] NavBar 컴포넌트 (로그아웃, 경로별 조건부 표시)
- [ ] diagnosis 페이지 시각화 업그레이드 (인터랙티브 axis-row)
- [ ] report 페이지 ScoreGauge + 애니메이션 적용
- [ ] 기존 테스트 통과 + 신규 테스트 추가
- [ ] `.ai.md` 최신화

---

## 핵심 제약

`NEXT_PUBLIC_` 환경변수 사용 금지 → 브라우저 Supabase 클라이언트 없음 → 로그인/회원가입은 Server Action으로 구현.

---

## 구현 계획

### Step 1: 패키지 설치 + DB 마이그레이션 + globals.css

**1-1. 패키지 설치**
```bash
cd services/kwan && npm install @supabase/ssr recharts lucide-react
```

**1-2. Prisma 스키마 수정** (`prisma/schema.prisma`)
- Resume: `userId String?`, `fileName String?`, `@@index([userId])`
- InterviewSession: `userId String?`
- Report: `userId String?`
- 전부 nullable → 기존 데이터 하위 호환
- `npx prisma migrate dev --name add_user_fields`

**1-3. globals.css 교체** (`src/app/globals.css` 전면 교체)
- 참고: `services/siw/src/app/globals.css`
- 이식: Pretendard, `:root` 토큰, `.glass-card`, `.gradient-text`, `.btn-primary/.btn-outline`, `.tag-*`, `.axis-row`, `.layered-card-wrapper`, animations, skeleton, scrollbar

---

### Step 2: Supabase 인증 인프라

**2-1. 서버 인증 클라이언트** — 생성: `src/lib/supabase/server.ts`
- `createServerClient` from `@supabase/ssr` + cookies
- `SUPABASE_URL` + `SUPABASE_ANON_KEY` (NEXT_PUBLIC_ 아님)
- 기존 `src/lib/supabase.ts` (스토리지 전용) 그대로 유지, 두 파일 공존
- 참고: `seung/src/lib/supabase/server.ts`

**2-2. 미들웨어** — 생성: `src/middleware.ts`
- 보호 경로: `/upload`, `/interview`, `/report`, `/diagnosis`, `/dashboard`
- E2E bypass: `NODE_ENV !== 'production'` + `__e2e_bypass` 쿠키
- 미인증 → `/login?redirectTo=<pathname>` 리다이렉트
- 참고: `seung/src/middleware.ts`

**2-3. 로그인** (Server Action 방식)
- 생성: `src/app/login/actions.ts` — `loginAction` (Server Action)
- 생성: `src/app/login/LoginForm.tsx` — `'use client'`, React 19 `useActionState`
- 생성: `src/app/login/page.tsx` — Suspense wrapper
- Open Redirect 방어: `startsWith('/') && !startsWith('//')`

**2-4. 회원가입** (Server Action)
- 생성: `src/app/signup/actions.ts` — `signupAction`
- 생성: `src/app/signup/SignupForm.tsx` — `'use client'`, `useActionState`
- 생성: `src/app/signup/page.tsx`
- `emailRedirectTo: ${origin}/auth/callback`

**2-5. 인증 콜백** — 생성: `src/app/auth/callback/route.ts`
- code → `exchangeCodeForSession` → `/dashboard`
- 실패 → `/login?error=invalid_code`
- 참고: `seung/src/app/auth/callback/route.ts`

**2-6. 환경변수** — `.env.local` + EC2 env-file에 `SUPABASE_ANON_KEY` 추가

---

### Step 3: API 라우트 인증 게이트 + 테스트 동시 수정

> 라우트 수정과 테스트 mock을 동시에 작업 — 중간에 깨지는 상태 방지.

**공통 패턴** (라우트 상단):
```typescript
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 })
```

**공통 테스트 mock** (`vi.hoisted`에 추가):
```typescript
mockCreateClient: vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
// beforeEach: mockCreateClient.mockResolvedValue({ auth: { getUser: ... } })
```

**수정 대상 (9개 라우트 + 9개 테스트)**:

| 라우트 | 변경 | 테스트 |
|---|---|---|
| `api/resume/questions/route.ts` | 인증 + `userId`, `fileName` → prisma.create | `resume-questions.test.ts` |
| `api/resume/feedback/route.ts` | 인증 + 소유권(`resume.userId !== user.id` → 403) | `resume-feedback.test.ts` |
| `api/resume/diagnosis/route.ts` | 인증 + 소유권(`resume.userId !== user.id` → 403) | `resume-diagnosis.test.ts` |
| `api/interview/start/route.ts` | 인증 + `userId` → session.create | `interview-start.test.ts` |
| `api/interview/answer/route.ts` | 인증 + 소유권(`session.userId !== user.id` → 403) | `interview-answer.test.ts` |
| `api/interview/session/route.ts` | 인증 + 소유권(`session.userId !== user.id` → 403) | `interview-session.test.ts` |
| `api/report/generate/route.ts` | 인증 + `userId` → report.create | `report-generate.test.ts` |
| `api/report/route.ts` | 인증 + 소유권(`report.userId !== user.id` → 403) | `report-get.test.ts` |
| `api/practice/feedback/route.ts` | 인증만 (stateless) | `practice-feedback.test.ts` |

> **소유권 검증 패턴**: 리소스 조회 후 `resource.userId !== user.id`이면 `403` 반환. 각 테스트에 `'403 타인 데이터 접근 차단'` TC 추가.

예외: `api/health/route.ts` — ALB 헬스체크, 인증 제외.

**신규 라우트 (3개 + 3개 테스트)**:

| 파일 | 설명 | 참고 |
|---|---|---|
| `api/dashboard/route.ts` | GET — userId로 이력서 목록 + 세션/리포트 | `seung/api/dashboard/route.ts` |
| `api/user/progress/route.ts` | GET — userId로 리포트 점수 히스토리 | `seung/api/user/progress/route.ts` |
| `api/resume/[id]/route.ts` | DELETE — 소유권 확인 + cascade 삭제 | `seung/api/resume/[id]/route.ts` |

---

### Step 4: 컴포넌트

**4-1. NavBar** — 생성: `src/components/NavBar.tsx`
- Client component, `onSignOut` server action prop
- `/`, `/login`, `/signup`에서 숨김
- 참고: `seung/src/components/NavBar.tsx`

**4-2. ScoreGauge** — 생성: `src/components/ScoreGauge.tsx`
- SVG 원형 게이지, 점수별 색상 (80+ 초록, 60+ 노랑, <60 빨강)
- 참고: `seung/src/components/ScoreGauge.tsx`

**4-3. 대시보드 타입** — 수정: `src/domain/interview/types.ts`
- `DashboardResumeItem`, `DashboardResponse`, `UserProgressItem`, `UserProgressResponse`
- 참고: `seung/src/lib/types.ts` (142~168행)

---

### Step 5: 페이지 작업

**5-1. layout.tsx 수정**
- `lang="ko"`, async Server Component + auth 체크
- `signOut` 서버 액션, `{user && <NavBar onSignOut={signOut} />}`
- 참고: `seung/src/app/layout.tsx`

**5-2. 랜딩 페이지 (/) — 전면 재작성**
- `page.tsx` → Server Component (인증 체크 → `isLoggedIn` prop)
- `LandingContent.tsx` → Client Component
- 구성: Sticky nav → Hero → Features → Personas → Evaluation → CTA → Footer
- FadeInSection (IntersectionObserver), StartButton (isLoggedIn 분기)
- 참고: `siw/src/app/(landing)/page.tsx`

**5-3. 업로드 페이지 (/upload)** — 생성: `src/app/upload/page.tsx`
- 기존 `page.tsx` 업로드 로직 이동
- 디자인 시스템 클래스 적용, `router.replace('/dashboard')`

**5-4. 대시보드 (/dashboard)** — 생성: `src/app/dashboard/page.tsx`
- fetch `/api/dashboard` + `/api/user/progress`
- LoadingScreen, EmptyState, ResumeCard, 성장 LineChart
- 참고: `seung/src/app/dashboard/page.tsx`

**5-5. diagnosis 업그레이드** — `axis-row` CSS, `glass-card`

**5-6. report 업그레이드** — `<ScoreGauge />`, `axis-row`, `glass-card`

**5-7. interview 수정** — `glass-card` + `btn-primary`, 완료 → `/dashboard`

---

### Step 6: 테스트 + 빌드 확인

- 기존 테스트 전체 PASS (Step 3에서 mock 추가됨)
- 신규 단위 테스트: `NavBar.test.tsx`, `DashboardPage.test.tsx`
- 미들웨어 단위 테스트: `tests/middleware.test.ts`
  - 보호 경로 미인증 → `/login?redirectTo=` 리다이렉트 확인
  - 비보호 경로(`/`, `/login`, `/api/health`) → 통과 확인
  - E2E bypass: `__e2e_bypass` 쿠키 + non-production → 통과 확인
- E2E 테스트 업데이트:
  - `e2e/interview-flow.spec.ts`, `e2e/phase3-full-flow.spec.ts`
  - `page.goto('/')` → `page.goto('/upload')` 변경
  - `test.beforeEach`에 `__e2e_bypass` 쿠키 설정 추가
- `npm run build` 성공

---

### Step 7: .ai.md 최신화

- 구조에 신규 파일/디렉토리 추가
- 불변식 업데이트: "인증 없음" → "Supabase Auth, NEXT_PUBLIC_ 미사용"
- 환경변수 `SUPABASE_ANON_KEY` 추가
- API/페이지 목록 업데이트

---

## 검증 체크리스트

1. `npx prisma migrate dev` 성공
2. `npm run build` 성공
3. `npm test` 전체 PASS (단위 + 미들웨어)
4. 비로그인 → /upload → /login?redirectTo=/upload 리다이렉트
5. 랜딩 페이지(/) 정상 렌더링
6. 대시보드 이력서 목록 + 성장 차트
7. NavBar 표시/숨김
8. 타인 데이터 접근 시 403 반환 (소유권 검증)
9. E2E 테스트 전체 PASS (`__e2e_bypass` 쿠키 사용)

---

## 핵심 참고 파일

| 역할 | 파일 |
|---|---|
| 인증 클라이언트 | `seung/src/lib/supabase/server.ts` |
| 미들웨어 | `seung/src/middleware.ts` |
| 로그인/회원가입 | `seung/src/app/login/page.tsx`, `signup/page.tsx` |
| 레이아웃 + NavBar | `seung/src/app/layout.tsx`, `seung/src/components/NavBar.tsx` |
| 대시보드 | `seung/src/app/dashboard/page.tsx` |
| 대시보드/진행도/삭제 API | `seung/src/app/api/dashboard/`, `user/progress/`, `resume/[id]/` |
| ScoreGauge | `seung/src/components/ScoreGauge.tsx` |
| 디자인 시스템 CSS | `siw/src/app/globals.css` |
| 랜딩 페이지 | `siw/src/app/(landing)/page.tsx` |
| 인터랙티브 차트 | `siw/src/components/landing/RadarChartInteractive.tsx` |
| 대시보드 타입 | `seung/src/lib/types.ts` (142~168행) |
