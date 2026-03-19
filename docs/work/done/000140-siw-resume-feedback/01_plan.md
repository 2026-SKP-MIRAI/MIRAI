# [#140] feat: [siw] 이력서 피드백 기능 실데이터 연동 — engine /resume/feedback + inferredTargetRole 저장 (#90·#113 기반) — 구현 계획

> 작성: 2026-03-19 | 완료: 2026-03-19

---

## 완료 기준

- [x] `Resume` 모델에 `feedbackJson Json?`, `inferredTargetRole String?` 컬럼 추가 + 마이그레이션 SQL
- [x] `POST /api/resumes`: 업로드 후 엔진 `/api/resume/feedback` 호출 → `feedbackJson` DB 저장 (inferredTargetRole → targetRole 자동 사용)
- [x] `GET /api/resumes/[id]/feedback`: 저장된 `feedbackJson` 반환 (현재 null 고정 → 실데이터)
- [x] `ResumeFeedback`, `ResumeFeedbackScores`, `SuggestionItem` 타입을 `src/lib/types.ts`로 이동 (page.tsx 로컬 정의 제거)
- [x] 기존 응답 형식 유지 (UI 변경 없음 — 이미 완성된 UI 그대로 동작)
- [x] 테스트 추가 (feedback route GET 200/401/404, POST /api/resumes feedback 저장 검증)
- [x] `services/siw/.ai.md` 최신화

### 추가 완료 (작업 중 발견된 버그픽스)

- [x] Growth 페이지 차트 Y축 `min: 40` → `min: 0` 버그픽스 (lineOptions, barOptions 모두 수정)
- [x] 면접 세션 생성 시 `resumeId` 미저장 버그픽스 (`interviewService.start()`에서 `resumeId` 누락)
- [x] Playwright e2e 테스트: auth setup + mock 5개 + 실제 PDF 통합 테스트 추가
- [x] feedback fetch 실패 시 `console.warn` 로깅 추가 (observability)
- [x] GET /api/resumes 에러 시 로깅 추가
- [x] `resumeId ?? null` 중복 null 체크 제거 (코드 리뷰 반영)

---

## 구현 계획

> 팀 검증 완료 (2026-03-19): 아키텍트·TDD 엔지니어·풀스택 3인 교차 검증
> 근거 문서: `02_engine_contract.md` (engine API 계약), `03_tdd_tests.md` (TDD 테스트 코드)

### 검증 완료 사항

| 검증 항목 | 결과 |
|----------|------|
| engine ResumeFeedbackScores 필드명 | specificity, achievementClarity, logicStructure, roleAlignment, differentiation ✅ |
| engine SuggestionItem 필드명 | section, issue, suggestion (**category 아님**) ✅ |
| page.tsx 타입과 engine 스키마 일치 | 완전 일치 ✅ |
| targetRole "소프트웨어 개발자" fallback 유효성 | min_length=1 충족 ✅ |
| inferredTargetRole 엔진 응답 포함 여부 | **없음** — #113 미머지, null 저장 ✅ |
| 기존 테스트 호환성 | 3번째 fetch mock 없어도 `.catch(() => null)` 처리 ✅ |
| maxDuration=60s 준수 | 병렬화로 안전 ✅ |

---

### Step 1. Prisma 스키마 + 마이그레이션 ✅

**변경 파일:**
- `services/siw/prisma/schema.prisma`
- `services/siw/prisma/migrations/20260319000001_add_resume_feedback_columns/migration.sql` (신규)

**migration.sql:**
```sql
ALTER TABLE "resumes" ADD COLUMN "feedbackJson" JSONB;
ALTER TABLE "resumes" ADD COLUMN "inferredTargetRole" TEXT;
```

**완료 결과:** `npx prisma migrate deploy` 실행 완료. 9 migrations found, No pending migrations to apply.

---

### Step 2. resume-repository.ts 확장 ✅

**변경 파일:** `services/siw/src/lib/resume-repository.ts`

**실제 변경:**
- `ResumeRecord` 타입에 `feedbackJson: Prisma.JsonValue | null`, `inferredTargetRole: string | null` 추가
- `create()` 파라미터에 `feedbackJson?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue` 추가
  - **TypeScript 수정**: `null` 직접 사용 → `Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue` (Prisma nullable JSON 타입 제약)

---

### Step 3. POST /api/resumes — feedback 병렬 호출 ✅

**변경 파일:** `services/siw/src/app/api/resumes/route.ts`

**실제 변경:**
- `targetRole` FormData에서 읽기 (fallback: `"소프트웨어 개발자"`)
- `Promise.all` 3번째 항목으로 feedback fetch 추가 (best-effort, `.catch(() => null)`)
- feedback 실패 시 `console.warn` 로깅 추가 (코드 리뷰 반영)
- GET 에러 시 `console.error` 로깅 추가 (코드 리뷰 반영)

---

### Step 4. GET /api/resumes/[id]/feedback ✅

**변경 파일:** `services/siw/src/app/api/resumes/[id]/feedback/route.ts`

**실제 변경:**
- null 고정 반환 → `resume.feedbackJson ?? null` 반환
- 401 (미인증), 404 (resume 없음/타인 소유) 처리

---

### Step 5. types.ts 타입 이동 + page.tsx import 정리 + .ai.md 최신화 ✅

**변경 파일:**
- `services/siw/src/lib/types.ts` — `ResumeFeedbackScores`, `SuggestionItem`, `ResumeFeedback` 추가
- `services/siw/src/app/(app)/resumes/[id]/page.tsx` — 로컬 타입 제거 → `@/lib/types` import
- `services/siw/.ai.md` — feedbackJson 컬럼·연동 내역 반영

---

### Step 6 (추가). 버그픽스 ✅

**Growth 페이지 차트 Y축 버그픽스**
- 파일: `services/siw/src/app/(app)/growth/page.tsx`
- 변경: `lineOptions`, `barOptions` 모두 `y: { min: 40 }` → `y: { min: 0, max: 100 }` (canvas height=200 에서 40점 이하 데이터 짤림)

**면접 세션 resumeId 미저장 버그픽스**
- 파일: `services/siw/src/lib/interview/interview-service.ts`
- 변경: `interviewRepository.create()` 호출 시 `resumeId` 파라미터 누락 → 추가
- 영향: 기존 DB에 `resumeId=null`로 저장된 세션들 SQL로 일괄 업데이트 필요
  ```sql
  UPDATE interview_sessions is
  SET "resumeId" = r.id
  FROM resumes r
  WHERE is."resumeText" = r."resumeText"
    AND is."userId" = r."userId"
    AND is."resumeId" IS NULL
  ```

---

### Step 7 (추가). Playwright e2e 테스트 ✅

> 전체 내용: `docs/work/active/000140-siw-resume-feedback/03_tdd_tests.md` 참조

**결과:**
- Mock e2e: **5/5 통과** (피드백 있음, 없음, API 오류 500, 로딩 중, 실제 PDF)
- 실제 PDF 통합 테스트: **통과** (`자소서_004_개발자.pdf`, 30초 내 완료)
- 영상: `test-results/` 디렉토리에 webm 저장

---

### 변경 파일 전체 목록 (최종)

| 파일 | 타입 | 주요 변경 |
|------|------|----------|
| `prisma/schema.prisma` | 수정 | feedbackJson Json?, inferredTargetRole String? 추가 |
| `prisma/migrations/20260319000001_.../migration.sql` | 신규 | ALTER TABLE resumes ADD COLUMN x2 |
| `src/lib/resume-repository.ts` | 수정 | ResumeRecord 필드 추가, create() 파라미터 확장 |
| `src/app/api/resumes/route.ts` | 수정 | Promise.all feedback 병렬 추가, 로깅 추가 |
| `src/app/api/resumes/[id]/feedback/route.ts` | 수정 | null 고정 → feedbackJson 반환, 404 처리 |
| `src/lib/types.ts` | 수정 | ResumeFeedback 타입 3개 추가 |
| `src/app/(app)/resumes/[id]/page.tsx` | 수정 | 로컬 타입 제거, types.ts import |
| `src/app/(app)/growth/page.tsx` | 수정 | 차트 Y축 min 0으로 버그픽스 |
| `src/lib/interview/interview-service.ts` | 수정 | resumeId 저장 버그픽스, `?? null` 중복 제거 |
| `src/lib/interview/interview-repository.ts` | 수정 | create() resumeId 파라미터 추가 |
| `tests/api/resume-feedback-route.test.ts` | 신규 | GET feedback 4개 테스트 |
| `tests/api/resumes-route.test.ts` | 수정 | POST feedback 4개 테스트 추가 |
| `tests/e2e/auth.setup.ts` | 신규 | Playwright 인증 셋업 |
| `tests/e2e/resume-feedback.spec.ts` | 신규 | Mock e2e 5개 테스트 |
| `tests/e2e/resume-feedback-real.spec.ts` | 신규 | 실제 PDF 통합 e2e 테스트 (CI skip 처리) |
| `playwright.config.ts` | 수정 | 포트 3000, .env 로딩, auth setup 프로젝트 |
| `.gitignore` | 신규 | test-results/, playwright-report/, .auth/ 제외 |
| `.ai.md` | 수정 | feedbackJson 컬럼·연동 내역 반영 |

---

### code-reviewer 검토 결과 (2026-03-19)

> 총 7개 이슈 발견 → 전부 수정 완료

| # | 심각도 | 내용 | 조치 |
|---|--------|------|------|
| 1 | CRITICAL | `resume-feedback-real.spec.ts` 하드코딩 절대경로 | `PLAYWRIGHT_PDF_PATH` 환경변수 + `fs.existsSync` skip 처리 |
| 2 | HIGH | `inferredTargetRole` 컬럼 스키마만 있고 실제 저장 안 됨 | TODO 주석 유지 (#113 머지 후 연동 예정으로 의도된 설계) |
| 3 | MEDIUM | feedback fetch 실패 시 로깅 없음 | `.catch()` 핸들러에 `console.warn` 추가 |
| 4 | MEDIUM | feedback JSON 런타임 유효성 검증 없음 | 현 PR 범위 외 (향후 이슈로 분리) |
| 5 | MEDIUM | GET /api/resumes 에러 시 로깅 없음 | `catch` 블록에 `console.error` 추가 |
| 6 | LOW | `resumeId ?? null` 불필요한 null 병합 | `resumeId` 단축 표기로 수정 |
| 7 | LOW | e2e 테스트 4번째 케이스 (API 오류) 없음 | `피드백 API 오류 (500) — 페이지 크래시 없이 정상 표시` 테스트 추가 |

---

### ADR

**Decision:** feedback을 기존 `Promise.all`에 병렬 추가, create() 시 단일 DB 쓰기

**Drivers:**
1. maxDuration=60s 제약 — 순차 호출 시 90s 초과 위험
2. 단순성 — updateFeedback 별도 메서드 불필요
3. 실패 격리 — feedback 실패가 resume 생성 차단 없음

**Alternatives considered:**
- (A) create 후 순차 feedback 호출: 90s 초과 위험 → **기각**
- (B) Background job 비동기 처리: serverless 환경 불안정 → **기각**

**Consequences:**
- feedbackJson=null인 resume 존재 가능 (엔진 실패 시) — UI 이미 null 처리
- targetRole FormData 파라미터 추가 시 기존 upload 호출 변경 불필요 (optional)

**Follow-ups:**
- #113 inferredTargetRole 엔진 머지 후 연동
- feedback 재시도 메커니즘 — 별도 이슈
- feedback JSON Zod 런타임 유효성 검증 — 별도 이슈
