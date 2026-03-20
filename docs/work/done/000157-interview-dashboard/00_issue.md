# feat: [seung] 내 면접 기록 대시보드

## 사용자 관점 목표
로그인 후 내가 업로드한 자소서, 진행한 면접 세션, 역량 리포트, 서류 진단 결과를 한눈에 확인하고 바로 이어볼 수 있다.

## 배경
이슈 #151로 Supabase Auth가 연동됐지만 로그인 후 이동할 곳이 `/resume`(새 업로드 페이지)뿐이다. `Resume`, `InterviewSession`, `Report` 테이블에 `userId`가 저장되고 있으므로 사용자별 기록 조회가 가능한 상태다. 로그인의 가치를 직접 느낄 수 있는 대시보드가 필요하다.

## 완료 기준
- [x] `GET /api/dashboard` — 로그인된 userId의 Resume 목록 반환 (InterviewSession 수, Report 유무, diagnosisResult 유무, fileName 포함)
- [x] `/dashboard` 페이지 — 자소서별 카드 (파일명, 업로드 날짜, 면접 세션 수, 리포트 링크, 서류 진단 링크)
- [x] `src/app/page.tsx` 루트 리다이렉트 `/resume` → `/dashboard`로 변경
- [x] `src/app/login/page.tsx` 로그인 성공 후 기본 리다이렉트 `/resume` → `/dashboard`로 변경
- [x] `src/app/auth/callback/route.ts` OAuth 콜백 리다이렉트 `/resume` → `/dashboard`로 변경
- [x] `src/middleware.ts` 보호 경로에 `/dashboard` 추가
- [x] 대시보드에서 "새 면접 시작" 버튼 → `/resume`로 이동
- [x] 카드에서 "이 자소서로 다시 면접하기" → `/resume?resumeId=` (업로드 스킵, 바로 모드 선택)
- [x] 기록 없을 때 빈 상태(empty state) UI 처리
- [x] `DELETE /api/resume/[id]` — 자소서 + 면접 세션 + 리포트 cascade 삭제
- [x] 대시보드 카드에서 자소서 삭제 기능
- [x] `prisma/schema.prisma` Resume 모델에 `fileName String?` 추가
- [x] Vitest + E2E 테스트 포함

## 구현 플랜
1. `GET /api/dashboard` 신규 라우트 — Prisma로 userId 기준 Resume 목록 조회 (sessions count, report 유무, diagnosisResult 유무)
2. `/dashboard` 페이지 신규 생성 — 자소서별 카드 렌더링, 빈 상태 UI
3. `page.tsx`, `login/page.tsx`, `auth/callback/route.ts`, `middleware.ts` 리다이렉트/보호 경로 수정
4. Vitest(API 라우트) + Playwright E2E 테스트 추가

## 개발 체크리스트
- [x] 테스트 코드 포함
- [x] 해당 디렉토리 .ai.md 최신화
- [x] 불변식 위반 없음


---

## 작업 내역

### 신규 파일

**`src/app/api/dashboard/route.ts`** — `GET /api/dashboard`
- Supabase `getUser()`로 userId 확인 → 없으면 401
- `prisma.resume.findMany({ where: { userId }, include: { sessions: { include: { report: true } } }, orderBy: { createdAt: 'desc' } })`로 한 번의 쿼리로 전체 집계
- 응답 shape: `{ resumes: Array<{ id, createdAt, fileName, sessionCount, hasReport, reportId, hasDiagnosis }> }`
- `fileName` null일 때 `자소서 (날짜)` 폴백 처리

**`src/app/api/resume/[id]/route.ts`** — `DELETE /api/resume/[id]`
- 인증 → 404(리소스 없음) → 403(소유권) 순서로 검증
- `prisma.$transaction([deleteMany(Report), deleteMany(Session), delete(Resume)])` — `onDelete: Cascade` 없으므로 수동 순서 트랜잭션
- 성공 시 204 반환

**`src/app/dashboard/page.tsx`** — 대시보드 페이지
- Client Component + `useEffect` + `fetch('/api/dashboard')` 패턴 (report/page.tsx와 동일)
- 카드: 파일명, 날짜, 세션 수, 리포트/진단 버튼, 삭제 버튼, 재사용 버튼
- 삭제: `window.confirm()` → `DELETE /api/resume/${id}` → 로컬 상태에서 즉시 제거 (낙관적 UI)
- 빈 상태: "아직 업로드한 자소서가 없습니다." + "새 면접 시작" 버튼

**`tests/api/dashboard.test.ts`** / **`tests/api/resume-delete.test.ts`** — Vitest
- `vi.hoisted()` 패턴으로 `mockPrisma`, `mockCreateClient` 세팅
- 각각 4케이스(200/401/빈목록/500), 5케이스(204/401/404/403/500)

**`tests/e2e/dashboard.spec.ts`** — Playwright E2E
- `__e2e_bypass=1` 쿠키 + 미들웨어 조건으로 Supabase 인증 우회 (서버사이드 모킹 불가 문제 해결)
- `page.route('**/api/dashboard', ...)` 로 API 모킹
- 5케이스 작성. 로컬 dev 서버 lock/ChunkLoadError 이슈로 CI에서 검증 예정

---

### 수정 파일

| 파일 | 변경 |
|------|------|
| `prisma/schema.prisma` | Resume에 `fileName String?` 추가 + 마이그레이션 |
| `src/app/api/resume/questions/route.ts` | `prisma.resume.create()`에 `fileName: file.name` 추가 |
| `src/app/resume/page.tsx` | `useSearchParams`로 `?resumeId=` 감지 → 업로드 스킵, 바로 모드 선택 |
| `src/app/page.tsx` | 루트 리다이렉트 `/resume` → `/dashboard` |
| `src/app/login/page.tsx` | 로그인 fallback `/resume` → `/dashboard` |
| `src/app/auth/callback/route.ts` | OAuth 콜백 리다이렉트 `/resume` → `/dashboard` |
| `src/app/interview/page.tsx` | `handleRestart` `/resume` → `/dashboard` |
| `src/app/report/page.tsx` | "홈으로" 버튼 `/resume` → `/dashboard` |
| `src/app/diagnosis/page.tsx` | "홈으로" 버튼 `/resume` → `/dashboard` |
| `src/middleware.ts` | `/dashboard` 보호 경로 추가 + `__e2e_bypass` 쿠키 우회 |
| `playwright.config.ts` | CI: `E2E_AUTH_BYPASS=1 npm run start` 주입 |
| `src/lib/types.ts` | `DashboardResumeItem`, `DashboardResponse` 타입 추가 |

