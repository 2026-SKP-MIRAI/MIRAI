# [#157] feat: [seung] 내 면접 기록 대시보드 — 구현 계획

> 작성: 2026-03-20

---

## 완료 기준

- [x] `GET /api/dashboard` — 로그인된 userId의 Resume 목록 반환 (InterviewSession 수, Report 유무, diagnosisResult 유무, fileName 포함)
- [x] `/dashboard` 페이지 — 자소서별 카드 (파일명, 업로드 날짜, 면접 세션 수, 리포트 링크, 서류 진단 링크)
- [x] `src/app/page.tsx` 루트 리다이렉트 `/resume` → `/dashboard`로 변경
- [x] `src/app/login/page.tsx` 로그인 성공 후 기본 리다이렉트 `/resume` → `/dashboard`로 변경
- [x] `src/middleware.ts` 보호 경로에 `/dashboard` 추가
- [x] 대시보드에서 "새 면접 시작" 버튼 → `/resume`로 이동
- [x] 카드에서 "이 자소서로 다시 면접하기" → `/resume?resumeId=` (업로드 스킵, 바로 모드 선택)
- [x] 기록 없을 때 빈 상태(empty state) UI 처리
- [x] `DELETE /api/resume/[id]` — 자소서 + 면접 세션 + 리포트 cascade 삭제
- [x] 대시보드 카드에서 자소서 삭제 기능
- [x] `prisma/schema.prisma` Resume 모델에 `fileName String?` 추가
- [x] Vitest + E2E 테스트 포함

---

## 구현 계획

### 원칙
1. 아키텍처 불변식 준수 (인증은 서비스에서만, 엔진은 stateless)
2. 기존 패턴 일관성 유지 — Client Component + API route + `useEffect/fetch` (report/page.tsx, diagnosis/page.tsx와 동일)
3. TDD: 테스트 먼저 작성 후 구현
4. 최소 변경: 요청된 기능만 추가

---

### 단계 요약

| 단계 | 작업 | 핵심 파일 |
|------|------|----------|
| Step 0 | DB 스키마 — `fileName` 필드 추가 및 마이그레이션 | `prisma/schema.prisma`, `api/resume/questions/route.ts` |
| Step 1 | `GET /api/dashboard` API 라우트 + Vitest | `api/dashboard/route.ts`, `tests/api/dashboard.test.ts` |
| Step 2 | `/dashboard` 페이지 (Client Component) + 삭제 버튼 | `app/dashboard/page.tsx` |
| Step 3 | 라우팅 변경 — 모든 로그인 후 리다이렉트를 `/dashboard`로 통일 | `page.tsx`, `login/page.tsx`, `auth/callback/route.ts`, `middleware.ts`, `report/page.tsx`, `diagnosis/page.tsx`, `interview/page.tsx` |
| Step 4 | `DELETE /api/resume/[id]` + Vitest | `api/resume/[id]/route.ts`, `tests/api/resume-delete.test.ts` |
| Step 5 | `/resume` 재사용 플로우 + E2E 테스트 + `.ai.md` | `app/resume/page.tsx`, `tests/e2e/dashboard.spec.ts`, `.ai.md` 3개 |

---

### Step 0: `prisma/schema.prisma` — fileName 필드 추가 (마이그레이션)

**`services/seung/prisma/schema.prisma` 수정**
- `Resume` 모델에 `fileName String?` 추가
- 마이그레이션: `prisma migrate dev --name add_resume_filename`
  - 생성된 마이그레이션: `20260320013545_add_resume_filename`

**`services/seung/src/app/api/resume/questions/route.ts` 수정**
- `prisma.resume.create()` 호출에 `fileName: file.name` 추가

---

### Step 1: `GET /api/dashboard` API 라우트 + Vitest (TDD)

**신규 파일: `services/seung/src/app/api/dashboard/route.ts`**
- Supabase Auth로 userId 확인 → 없으면 401
- Prisma 쿼리:
  ```ts
  prisma.resume.findMany({
    where: { userId: user.id },
    include: {
      sessions: {
        include: { report: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
  ```
- 응답 형태:
  ```ts
  {
    resumes: Array<{
      id: string
      createdAt: string       // ISO string
      fileName: string        // fileName ?? `자소서 (날짜)` 폴백
      sessionCount: number
      hasReport: boolean
      reportId: string | null  // 첫 번째 완료된 세션의 report id
      hasDiagnosis: boolean    // diagnosisResult !== null
    }>
  }
  ```
- 소유권: `where: { userId }` 필터로 쿼리 단계에서 보장 (기존 api/report/route.ts 패턴보다 안전)
- DB 에러 시 500 반환 (try/catch + console.error)

**신규 파일: `services/seung/tests/api/dashboard.test.ts`**
- `vi.hoisted()`로 `mockPrisma`, `mockCreateClient` 세팅 (기존 report-get.test.ts 패턴)
- 테스트 케이스:
  - 정상: resume 목록 반환 → 200 + resumes 배열
  - 미인증: user null → 401
  - 빈 목록: resume 없을 때 → 200 + `resumes: []`
  - DB 에러: prisma throw → 500

---

### Step 2: `/dashboard` 페이지 (Client Component)

**신규 파일: `services/seung/src/app/dashboard/page.tsx`**
- `'use client'` — 기존 report/page.tsx, diagnosis/page.tsx와 동일한 Client Component + `useEffect` + `fetch('/api/dashboard')` 패턴
- 로딩 상태: 스피너 또는 skeleton
- 에러 상태: 에러 메시지 표시
- 데이터 있을 때: 자소서 카드 목록
  - 카드 내용: 업로드 날짜(formatDate), 면접 세션 수, 리포트 링크(`/report?reportId=...`), 서류 진단 링크(`/diagnosis?resumeId=...`)
  - 링크는 `hasReport`, `hasDiagnosis`가 true일 때만 표시
- 빈 상태: `resumes.length === 0`일 때
  - "아직 업로드한 자소서가 없습니다" 문구
  - "새 면접 시작" 버튼 → `router.push('/resume')`
- 모든 카드에도 "새 면접 시작" 버튼 표시 (대시보드 상단 or 하단)

---

### Step 3: 라우팅 변경

**`services/seung/src/app/page.tsx` (1줄 변경)**
```ts
// before
redirect('/resume')
// after
redirect('/dashboard')
```

**`services/seung/src/app/login/page.tsx` (1줄 변경, line 33)**
```ts
// before
const safePath = redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/resume'
// after
const safePath = redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/dashboard'
```

**`services/seung/src/middleware.ts` (1줄 추가, isProtectedPage 조건)**
```ts
const isProtectedPage =
  pathname.startsWith('/resume') ||
  pathname.startsWith('/interview') ||
  pathname.startsWith('/report') ||
  pathname.startsWith('/diagnosis') ||
  pathname.startsWith('/dashboard')   // 추가
```

**`services/seung/src/app/report/page.tsx` (홈으로 버튼만 변경)**
- line 160의 `router.push('/resume')` ("홈으로" 버튼) → `router.push('/dashboard')`
- 에러 fallback `router.replace('/resume')` (line 36, 43, 53)는 **유지** — 에러 시 재업로드 UX가 자연스러움
- 기존 E2E `tests/e2e/report-flow.spec.ts` line 134-138: `/resume` 리다이렉트 테스트는 에러 fallback 경로이므로 **변경 불필요**

**`services/seung/src/app/diagnosis/page.tsx` (홈으로 버튼만 변경)**
- "홈으로" 버튼의 `router.push('/resume')` → `router.push('/dashboard')`
- 에러 fallback `router.replace('/resume')`는 **유지**

**`services/seung/src/app/auth/callback/route.ts` (1줄 변경)**
```ts
// before
return NextResponse.redirect(new URL('/resume', request.url))
// after
return NextResponse.redirect(new URL('/dashboard', request.url))
```

**`services/seung/src/app/interview/page.tsx` (handleRestart 변경)**
```ts
// before
const handleRestart = () => { router.push('/resume') }
// after
const handleRestart = () => { router.push('/dashboard') }
```
- 에러 fallback은 **유지** — 에러 시 `/resume` 재업로드가 자연스러운 UX

---

### Step 4: `DELETE /api/resume/[id]` + Vitest (TDD)

**신규 파일: `services/seung/src/app/api/resume/[id]/route.ts`**
- Supabase Auth로 userId 확인 → 없으면 401
- `prisma.resume.findUnique({ where: { id } })` → 없으면 404
- `resume.userId !== user.id` → 403
- `prisma.$transaction([deleteMany(report), deleteMany(session), delete(resume)])` — cascade 삭제
  - Prisma 스키마에 `onDelete: Cascade`가 없으므로 수동 트랜잭션
- DB 에러 시 500

**신규 파일: `services/seung/tests/api/resume-delete.test.ts`**
- 테스트 케이스:
  - 정상 삭제 → 204
  - 미인증 → 401
  - 존재하지 않는 resume → 404
  - 타인 resume 삭제 시도 → 403
  - DB 에러 → 500

**`services/seung/src/app/dashboard/page.tsx` 수정**
- `ResumeCard`에 삭제 버튼 추가
  - `window.confirm()` → `DELETE /api/resume/${id}` → `onDelete(id)` 콜백으로 로컬 상태 제거

---

### Step 5: `/resume` 재사용 흐름 + E2E 테스트 + `.ai.md`

**`services/seung/src/app/resume/page.tsx` 수정**
- `useSearchParams`로 `?resumeId=` 파라미터 감지
- resumeId 있으면: 업로드 폼 없이 `state='done'`으로 직행 (result.questions=[] pre-fill)
- `QuestionList`는 `result.questions.length > 0`일 때만 렌더링

**신규 파일: `services/seung/tests/e2e/dashboard.spec.ts`**
- `page.route('**/api/dashboard', ...)` 로 API 모킹
- 테스트 케이스:
  - 자소서 카드 렌더링: 파일명, 날짜, 세션 수, 리포트 링크 표시
  - 빈 상태: "아직 업로드한 자소서가 없습니다" 텍스트 + "새 면접 시작" 버튼
  - "새 면접 시작" 버튼 클릭 → `/resume` 이동
  - "이 자소서로 다시 면접하기" 클릭 → `/resume?resumeId=...` 이동

**신규 파일: `services/seung/src/app/dashboard/.ai.md`**
- 목적: 사용자 면접 기록 대시보드 (이슈 #157)
- 구조: Client Component, `GET /api/dashboard` 호출, `DELETE /api/resume/[id]` 삭제
- 역할: 자소서별 면접 기록 요약 표시, 신규 면접 진입점, 자소서 삭제 및 재사용

---

### 변경 파일 목록

| 파일 | 신규/변경 |
|------|----------|
| `prisma/schema.prisma` | 변경 (`fileName String?` 추가) |
| `prisma/migrations/20260320013545_add_resume_filename/` | 신규 (마이그레이션) |
| `src/app/api/dashboard/route.ts` | 신규 |
| `src/app/api/resume/[id]/route.ts` | 신규 (DELETE) |
| `src/app/api/resume/questions/route.ts` | 변경 (`fileName` 저장 추가) |
| `tests/api/dashboard.test.ts` | 신규 |
| `tests/api/resume-delete.test.ts` | 신규 |
| `tests/api/questions.test.ts` | 변경 (`fileName` 어설션 추가) |
| `src/app/dashboard/page.tsx` | 신규 |
| `src/app/dashboard/.ai.md` | 신규 |
| `src/app/resume/page.tsx` | 변경 (`?resumeId=` 감지, 업로드 스킵) |
| `tests/e2e/dashboard.spec.ts` | 신규 |
| `src/app/page.tsx` | 변경 (1줄) |
| `src/app/login/page.tsx` | 변경 (1줄) |
| `src/middleware.ts` | 변경 (`/dashboard` 보호 경로 추가 + E2E 우회 쿠키 지원) |
| `src/app/auth/callback/route.ts` | 변경 (OAuth 콜백 리다이렉트 `/resume` → `/dashboard`) |
| `src/app/report/page.tsx` | 변경 (홈으로 버튼 `/resume` → `/dashboard`) |
| `src/app/diagnosis/page.tsx` | 변경 (홈으로 버튼 `/resume` → `/dashboard`) |
| `src/app/interview/page.tsx` | 변경 (`handleRestart` `/resume` → `/dashboard`) |
| `src/lib/types.ts` | 변경 (`DashboardResumeItem`, `DashboardResponse` 추가) |

---

### 주의사항

- `diagnosisResult`는 `Resume` 모델의 `Json?` nullable 필드 — `diagnosisResult !== null`로 판단
- 리포트 링크: 세션마다 report가 1개이므로, `sessions[*].report?.id` 중 존재하는 것을 반환 (첫 번째 완료 세션 기준)
- 테스트 작성 시 `vi.hoisted()` 패턴 필수 — Next.js App Router의 모듈 초기화 순서 이슈
- E2E에서 인증 우회: `middleware.ts`에 `__e2e_bypass=1` 쿠키 체크 추가 (non-production 전용). `dashboard.spec.ts`의 `beforeEach`에서 `context.addCookies()`로 주입. `page.route`는 브라우저 요청만 인터셉트하므로 서버사이드 미들웨어 Supabase 호출은 모킹 불가 — 이 방식으로 대체
- 기존 E2E (`interview-flow`, `report-flow` 등)도 #151 이후 같은 인증 이슈가 있음 — 별도 이슈로 추적 필요
