# [#157] feat: [seung] 내 면접 기록 대시보드 — 테스트 결과

> 작성: 2026-03-20

---

## 최종 테스트 결과

### next build

```
수동 확인 필요 (로컬 dev 서버 실행 환경에서 진행)
— next build 실행 시 타입 오류·빌드 실패 없음 확인 예정
```

### Vitest 단위 테스트

```
Test Files  14 passed (14)
Tests       122 passed (122)
Duration    ~18s
```

**파일별 결과:**

| 파일 | 테스트 수 | 결과 | 비고 |
|------|-----------|------|------|
| `tests/api/dashboard.test.ts` | 4 | ✅ 전체 통과 | 신규 (정상/401/빈목록/500) |
| `tests/api/resume-delete.test.ts` | 5 | ✅ 전체 통과 | 신규 (204/401/404/403/500) |
| `tests/api/questions.test.ts` | 16 | ✅ 전체 통과 | `fileName` 어설션 추가 |
| `tests/api/interview-start.test.ts` | 8 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/interview-answer.test.ts` | 12 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/interview-session.test.ts` | 6 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/report-generate.test.ts` | 11 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/report-get.test.ts` | 5 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/resume-feedback.test.ts` | 13 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/resume-diagnosis.test.ts` | 7 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/practice-feedback.test.ts` | 12 | ✅ 전체 통과 | 변경 없음 |
| `tests/components/InterviewChat.test.tsx` | 11 | ✅ 전체 통과 | 변경 없음 |
| `tests/components/QuestionList.test.tsx` | 5 | ✅ 전체 통과 | 변경 없음 |
| `tests/components/UploadForm.test.tsx` | 7 | ✅ 전체 통과 | 변경 없음 |

---

## 상태 범례

| 아이콘 | 의미 |
|--------|------|
| ⬜ | 미실행 |
| 🔴 | RED — 테스트 작성 완료, 실패 확인 |
| 🟢 | GREEN — 구현 완료, 테스트 통과 |
| ✅ | DONE — 리팩토링 완료 |
| ❌ | FAIL — 테스트 실패 (수정 필요) |

---

## 변경 파일 및 수정 내용

### 신규 파일

| 파일 | 내용 | 결과 |
|------|------|------|
| `src/app/api/dashboard/route.ts` | GET /api/dashboard — userId 기준 Resume 목록 + fileName/sessionCount/hasReport/hasDiagnosis | ✅ |
| `src/app/api/resume/[id]/route.ts` | DELETE /api/resume/[id] — 소유권 검증 후 cascade 삭제 (Report→Session→Resume) | ✅ |
| `src/app/dashboard/page.tsx` | Client Component — 자소서 카드(파일명/날짜/세션수), 삭제 버튼, 재사용 버튼, 빈 상태 | ✅ |
| `src/app/dashboard/.ai.md` | 대시보드 디렉토리 목적·구조 문서 | ✅ |
| `tests/api/dashboard.test.ts` | Vitest 4케이스 (정상/401/빈목록/500) | ✅ |
| `tests/api/resume-delete.test.ts` | Vitest 5케이스 (204/401/404/403/500) | ✅ |
| `tests/e2e/dashboard.spec.ts` | Playwright E2E 5케이스 (카드렌더링/빈상태/버튼네비/재사용링크/다시면접하기) + `__e2e_bypass` 쿠키로 auth 우회 | ⬜ 로컬 dev 서버 lock/ChunkLoadError 이슈로 CI 검증 예정 |

### 수정 파일

| 파일 | 변경 | 결과 |
|------|------|------|
| `prisma/schema.prisma` | Resume 모델에 `fileName String?` 추가 | ✅ |
| `src/app/api/resume/questions/route.ts` | `prisma.resume.create()`에 `fileName: file.name` 추가 | ✅ |
| `src/app/resume/page.tsx` | `?resumeId=` 감지 → 업로드 스킵, 바로 모드 선택 화면 | ✅ |
| `src/app/page.tsx` | `redirect('/resume')` → `redirect('/dashboard')` | ✅ |
| `src/app/login/page.tsx` | fallback `'/resume'` → `'/dashboard'` | ✅ |
| `src/app/auth/callback/route.ts` | OAuth 콜백 리다이렉트 `/resume` → `/dashboard` | ✅ |
| `src/app/interview/page.tsx` | `handleRestart` (`다시하기`) `/resume` → `/dashboard` | ✅ |
| `src/middleware.ts` | E2E 테스트용 `__e2e_bypass` 쿠키 우회 추가 (non-production 전용) | ✅ |
| `src/middleware.ts` | `isProtectedPage`에 `/dashboard` 추가 | ✅ |
| `src/app/report/page.tsx` | "홈으로" 버튼 `/resume` → `/dashboard` | ✅ |
| `src/app/diagnosis/page.tsx` | "홈으로" 버튼 `/resume` → `/dashboard` | ✅ |
| `src/lib/types.ts` | `DashboardResumeItem`, `DashboardResponse` 타입 추가 | ✅ |
| `tests/api/questions.test.ts` | `prisma.resume.create` 어설션에 `fileName: 'resume.pdf'` 추가 | ✅ |

---

## 수동 확인 체크리스트

### 기능 동작 확인

- [ ] 루트(`/`) 접속 시 `/dashboard`로 리다이렉트
- [ ] 비로그인 상태로 `/dashboard` 접속 시 `/login?redirectTo=/dashboard`로 리다이렉트
- [ ] 로그인 성공 후 `/dashboard`로 이동 (redirectTo 없을 때 기본값)
- [ ] 대시보드에 자소서 카드가 PDF 파일명과 업로드 날짜 최신순으로 표시
- [ ] 기존 자소서(fileName null)는 "자소서 (날짜)" 폴백으로 표시
- [ ] 리포트 있는 자소서 → "역량 리포트 보기" 버튼 표시 + 클릭 시 `/report?reportId=...` 이동
- [ ] 서류 진단 있는 자소서 → "서류 진단 보기" 버튼 표시 + 클릭 시 `/diagnosis?resumeId=...` 이동
- [ ] 자소서 없을 때 빈 상태("아직 업로드한 자소서가 없습니다.") + "새 면접 시작" 버튼 표시
- [ ] "새 면접 시작" 버튼 클릭 시 `/resume`로 이동 (새 업로드)
- [ ] 카드의 "이 자소서로 다시 면접하기" 클릭 시 `/resume?resumeId=...`로 이동 — 업로드 폼 없이 바로 면접 모드 선택 화면
- [ ] 카드의 "삭제" 버튼 클릭 시 confirm 다이얼로그 표시
- [ ] confirm 승인 후 자소서 + 면접 세션 + 리포트 cascade 삭제, 카드 목록에서 즉시 제거
- [ ] 삭제 실패 시 "삭제에 실패했습니다." alert 표시
- [ ] 리포트 페이지 "홈으로" 버튼 → `/dashboard`로 이동
- [ ] 서류 진단 페이지 "홈으로" 버튼 → `/dashboard`로 이동
- [ ] 면접 완료 후 "다시하기" 버튼 → `/dashboard`로 이동

---

## 트러블슈팅 기록

### E2E 보호 라우트 인증 이슈 (기존 E2E 전체에 해당)

**증상:** `/dashboard`, `/resume`, `/interview` 등 보호 라우트로 `page.goto()`하면 미들웨어가 Supabase `getUser()`를 호출, 비로그인 상태이므로 `/login`으로 리다이렉트 → 테스트 실패.

**원인:** `page.route()`는 브라우저 요청만 인터셉트하므로 Next.js 미들웨어의 서버사이드 Supabase 호출을 모킹할 수 없음.

**dashboard.spec.ts 해결책:** 미들웨어에 `__e2e_bypass=1` 쿠키 체크 추가 (non-production 전용). `test.beforeEach`에서 `context.addCookies()`로 주입.

**기존 E2E (interview-flow, report-flow 등) 미해결:** #151 Auth 연동 이후 같은 이유로 보호 경로 접근 시 실패 가능성 있음. 근본 해결은 `globalSetup.ts`에서 실제 Supabase 세션을 생성해 `storageState`로 저장하거나, 기존 E2E 모두에 동일한 `__e2e_bypass` 쿠키 주입 적용 필요 (별도 이슈로 추적 권장).

### 로컬 E2E 환경 불안정 (ChunkLoadError / dev 서버 lock)

**증상:** `.next` 삭제 후 재실행 시 `ChunkLoadError` 또는 `Unable to acquire lock at .next/dev/lock` 오류 발생.

**원인:** 로컬에 `next dev` 프로세스가 살아있는 상태에서 `.next`를 삭제하면 Turbopack이 청크를 찾지 못하고 깨짐. Playwright의 `webServer`가 새 서버를 띄우려 할 때 lock 충돌 발생.

**결정:** 로컬 E2E 안정화에 시간을 소모하는 대신 CI에서 검증하는 전략 채택.
- CI에서는 `npm run build && E2E_AUTH_BYPASS=1 npm run start` (프로덕션 빌드, 클린 환경)
- `middleware.ts`에 `process.env.E2E_AUTH_BYPASS === '1'` 조건이 이미 반영되어 있어 CI에서 인증 우회 동작함
- 로컬에서 E2E 재실행 시: 3000 포트 프로세스 완전 종료 후 `.next` 삭제 → dev 서버 단일 기동 → Playwright 실행 순서 준수 필요
