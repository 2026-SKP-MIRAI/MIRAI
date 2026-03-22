# feat: [kwan] Phase 3 — analyze 전환 + 기능 02·05·07 구현 (피드백·연습·리포트)

## Context

services/kwan은 현재 MVP(PDF 업로드 → 질문 생성 → 면접 시뮬레이션)까지 완료된 상태.
다음 단계로 아래 작업을 **1개 통합 이슈**로 진행한다:
- 인프라: `/parse` → `/analyze` 전환, `/questions`에 `targetRole` 주입, PDF 원본 저장
- 기능 02: 이력서·자소서 피드백 (진단 5축 점수)
- 기능 05: 연습 모드 즉각 피드백 (실전/연습 선택 + 재답변)
- 기능 07: 8축 역량 평가 리포트 생성

참고: seung(#127, #123, #81), siw(#140), dev_spec.md

---

## 완료 기준

### 1. 인프라 — analyze 전환 + targetRole + PDF 저장

- [x] `callEngineParse` → `callEngineAnalyze`로 변경; `/api/resume/analyze` 호출; 반환에 `targetRole` 포함
- [x] `callEngineQuestions(resumeText, targetRole)` — `{ resumeText, targetRole }` 전송
- [x] `POST /api/resume/questions` 라우트: analyze 응답에서 `targetRole` 추출 → questions에 전달
- [x] Prisma `Resume` 모델: `storageKey String?`, `inferredTargetRole String?` 컬럼 추가
- [x] Resume 생성 시 `inferredTargetRole` 저장
- [x] PDF 원본 저장 → `storageKey`에 경로 저장; 저장 실패해도 요청은 성공 (graceful degradation)
- [x] 기존 테스트 업데이트: analyze 응답 형태 `{ resumeText, extractedLength, targetRole }` 반영

### 2. 기능 02 — 이력서·자소서 피드백 (진단 5축 점수)

- [x] `POST /api/resume/feedback` 라우트: `{ resumeId, targetRole? }` 수신
  - DB에서 Resume 조회 → targetRole 미제공 시 `inferredTargetRole` 폴백 → 둘 다 없으면 `"미지정 직무"`
  - 엔진 `/api/resume/feedback` 호출 (timeout 40s, `maxDuration = 45`)
  - 결과를 `Resume.diagnosisResult`에 저장; 200 응답
- [x] `GET /api/resume/diagnosis?resumeId=xxx` 라우트: 저장된 `diagnosisResult` 반환; 404 처리
- [x] Prisma `Resume`: `diagnosisResult Json?` 추가
- [x] `engine-client.ts`: `callEngineResumeFeedback(resumeText, targetRole)` 추가
- [x] Zod: `ResumeFeedbackResponseSchema` (scores 5키, strengths, weaknesses, suggestions)
- [x] UI `/diagnosis?resumeId=xxx` 페이지: 5축 점수 바, 강점/약점 목록, 개선 제안 카드
- [x] 테스트: happy path, resumeId 누락(400), resume 없음(404), 엔진 에러(500), 타임아웃

### 3. 기능 05 — 연습 모드 즉각 피드백

- [x] `POST /api/practice/feedback` 라우트: `{ question, answer, previousAnswer? }`
  - 엔진 `/api/practice/feedback` 호출 (timeout 40s, `maxDuration = 45`)
  - 응답: `{ score, feedback: {good, improve}, keywords, improvedAnswerGuide, comparisonDelta? }`
  - DB 저장 없음 (stateless)
- [x] Prisma `InterviewSession`: `interviewMode String @default("real")` 추가
- [x] `POST /api/interview/start`: `mode` 파라미터 수신 → `interviewMode` 저장
- [x] `engine-client.ts`: `callEnginePracticeFeedback(question, answer, previousAnswer?)` 추가
- [x] Zod: `PracticeFeedbackResponseSchema`
- [x] UI: 모드 선택(실전/연습), 피드백 패널(점수·good/improve·키워드·가이드), "다시 답변하기" 버튼, 상태 머신(idle→first-feedback→retry-feedback)
- [x] 테스트: happy path, 필수 필드 누락(400), 타임아웃, previousAnswer 포함 시 comparisonDelta 확인

### 4. 기능 07 — 8축 역량 평가 리포트

- [x] Prisma `Report` 모델: `id`, `sessionId @unique` FK, `totalScore Int`, `scores Json`, `summary String`, `axisFeedbacks Json`, `createdAt`
- [x] `POST /api/report/generate`: `{ sessionId }`
  - `sessionComplete === true` 검증 (400), `history.length >= 5` 검증 (422)
  - 기존 Report 존재 시 기존 `reportId` 반환 (멱등)
  - 엔진 호출 **timeout 90s**, `maxDuration = 100`; P2002 중복 처리
- [x] `GET /api/report?reportId=xxx`: Report 조회, 404 처리
- [x] `engine-client.ts`: `callEngineReportGenerate(resumeText, history)` — **90s timeout**
- [x] Zod: `ReportGenerateResponseSchema` (totalScore, 8축 scores, summary, axisFeedbacks)
- [x] UI `/report?reportId=xxx` 페이지: totalScore, 8축 점수 바, summary, axisFeedbacks, 로딩(약 15초 소요)
- [x] `InterviewChat.tsx` 완료 상태에 "리포트 생성" 버튼
- [x] 테스트: happy path(201), 세션 미완료(400), history<5(422), 타임아웃, 중복(멱등 200)

### 5. 공통

- [x] `npm test` 전체 통과 (14파일 119개 TC)
- [x] `npm run build` 성공
- [x] `.ai.md` 업데이트

---

## 수정 대상 파일

| 파일 | 변경 |
|------|------|
| `src/lib/engine-client.ts` | `callEngineParse`→`callEngineAnalyze`, `callEngineQuestions` targetRole 추가, `callEngineResumeFeedback`·`callEnginePracticeFeedback`·`callEngineReportGenerate` 신규 |
| `src/app/api/resume/questions/route.ts` | analyze 호출, targetRole 추출·전달, `inferredTargetRole`+`storageKey` DB 저장 |
| `src/app/api/resume/feedback/route.ts` | **신규** — 기능02 POST |
| `src/app/api/resume/diagnosis/route.ts` | **신규** — 기능02 GET |
| `src/app/api/practice/feedback/route.ts` | **신규** — 기능05 |
| `src/app/api/interview/start/route.ts` | `mode` 파라미터 처리 |
| `src/app/api/report/generate/route.ts` | **신규** — 기능07 POST |
| `src/app/api/report/route.ts` | **신규** — 기능07 GET |
| `prisma/schema.prisma` | Resume 필드 추가, InterviewSession에 `interviewMode`, `Report` 모델 신규 |
| `src/domain/interview/schemas.ts` | `EngineAnalyzeResponseSchema`, `ResumeFeedbackResponseSchema`, `PracticeFeedbackResponseSchema`, `ReportGenerateResponseSchema` |
| `src/domain/interview/types.ts` | `InterviewMode`, `PracticeStepState`, `PracticeFeedback`, `AxisScores`, `AxisFeedback` |
| `src/app/diagnosis/page.tsx` | **신규** — 진단 결과 페이지 |
| `src/app/report/page.tsx` | **신규** — 리포트 페이지 |
| `src/app/interview/page.tsx` | 모드 선택 UI |
| `src/components/InterviewChat.tsx` | 연습 피드백 패널, 재답변 플로우, "리포트 생성" 버튼 |
| `tests/api/resume-questions.test.ts` | mock 업데이트 (analyze 응답) |
| `tests/api/resume-feedback.test.ts` | **신규** |
| `tests/api/practice-feedback.test.ts` | **신규** |
| `tests/api/report-generate.test.ts` | **신규** |

---

## 구현 순서

1. **인프라** — analyze 전환 + targetRole + PDF 저장 + Prisma 마이그레이션 (전체 기반)
2. **기능 02** — 피드백 API + 진단 페이지 (인프라의 `inferredTargetRole` 활용)
3. **기능 05** — 연습 모드 API + UI (독립적이나 Prisma 변경은 1에서 함께)
4. **기능 07** — 리포트 API + 페이지 (90s timeout 주의)
5. **통합 테스트 + .ai.md 최신화**

## 검증 방법

1. `npm test` — 전체 테스트 통과
2. `npm run build` — 빌드 성공
3. 로컬 엔진 연동 수동 테스트:
   - PDF 업로드 → targetRole 추출 확인
   - 피드백 요청 → 5축 점수 반환 확인
   - 연습 모드 → 피드백 + 재답변 → comparisonDelta 확인
   - 면접 5회 이상 → 리포트 생성 → 8축 점수 확인
4. `.ai.md` 최신 상태 확인

---

## 작업 내역

### 인프라

**`src/lib/engine-client.ts`**
- `callEngineParse` 제거 → `callEngineAnalyze(file: Blob)` 추가. `/api/resume/analyze` 호출, timeout 30s
- `callEngineQuestions`에 `targetRole?` 파라미터 추가
- `callEngineResumeFeedback`, `callEnginePracticeFeedback`, `callEngineReportGenerate` 신규 추가

**`src/lib/supabase.ts` + `src/lib/resume-storage.ts`**
- Supabase service client 초기화, `uploadResumePdf(buffer, fileName)` → `uploads/${uuid}.pdf` 저장

**`prisma/schema.prisma`**
- Resume: `storageKey String?`, `inferredTargetRole String?`, `diagnosisResult Json?` 추가
- InterviewSession: `interviewMode String @default("real")`, `report Report?` 관계 추가
- Report 모델 신규: `@@map("reports")`, `sessionId @unique`, 8축 scores, axisFeedbacks

**`src/domain/interview/schemas.ts`**
- `EngineAnalyzeResponseSchema` (refine: 공백 resumeText 거부)
- `ResumeFeedbackResponseSchema`, `ComparisonDeltaSchema`, `PracticeFeedbackResponseSchema`, `ReportGenerateResponseSchema` 추가

**`src/domain/interview/types.ts`**
- `InterviewMode`, `PracticeStepState`, `ComparisonDelta`, `PracticeFeedback` (good/improve: string[]), `AxisScores`, `AxisFeedback` 추가

**`src/app/api/resume/questions/route.ts`**
- analyze 전환: `callEngineAnalyze` → `EngineAnalyzeResponseSchema.safeParse`
- user-provided targetRole 우선 사용 (form field `targetRole`)
- `resumeId` form field 제공 시 기존 row 업데이트 모드 (analyze 생략, questions만 재생성) — 백그라운드 재호출 시 new row 생성 방지
- PDF fire-and-forget: `uploadResumePdf` → `storageKey` DB 업데이트

**`src/app/page.tsx`**
- PDF 업로드 → questions + inferredTargetRole 표시 → targetRole 확정 UI
- `handleConfirm`: feedback 포그라운드 + questions 백그라운드 (user-confirmed targetRole + 기존 resumeId 전달)

### 기능 02

**`src/app/api/resume/feedback/route.ts`** (신규)
- targetRole 폴백: 제공값 → inferredTargetRole → '미지정 직무'
- Zod 검증, `diagnosisResult` await DB 저장 (.catch로 실패 격리)

**`src/app/api/resume/diagnosis/route.ts`** (신규)
- `diagnosisResult` 없을 시 404 반환

**`src/app/diagnosis/page.tsx`** (신규)
- 5축 점수 바 (ScoreBar), 강점/약점 목록, 개선 제안 카드, "면접 시작" 버튼 → `/interview?resumeId=`

### 기능 05

**`src/app/api/practice/feedback/route.ts`** (신규)
- stateless, question/answer 타입 검증, Zod 검증

**`src/app/interview/page.tsx`**
- 모드 선택 UI (실전/연습) → `POST /api/interview/start { resumeId, mode }` 호출
- sessionId URL param 지원 (새로고침 호환)

**`src/components/InterviewChat.tsx`**
- `interviewMode` prop 추가
- 연습 모드: 답변 제출 → /answer + /practice/feedback → 피드백 패널 (good/improve 배열, comparisonDelta)
- 상태 머신: `previousAnswer !== undefined` 기준 first-feedback vs retry-feedback 전이
- retry-feedback 단계에서 "다시 답변하기" 미노출 (1회 재답변 제한)
- "리포트 생성" 버튼, 로딩 중 비활성화, 성공 시 `/report?reportId=` 이동

### 기능 07

**`src/app/api/report/generate/route.ts`** (신규)
- history 비배열 → 500, 길이 < 5 → 422 (분리 검증)
- 멱등성: findFirst → create → P2002 findUnique fallback

**`src/app/api/report/route.ts`** (신규)
- createdAt ISO 형식 반환

**`src/app/report/page.tsx`** (신규)
- 총점, 8축 ScoreBar, summary, axisFeedbacks strength/improvement 분리 카드

### 에러 핸들링 보강

모든 route의 DB 조회/생성 호출에 try/catch 추가:
- `resume/feedback`, `resume/diagnosis`, `report/route` (GET), `interview/start` (findUnique + create), `interview/session`, `report/generate` (findUnique + findFirst)

### 테스트

- 14개 파일, 119개 TC 전체 PASS
- 신규: `resume-feedback`, `resume-diagnosis`, `practice-feedback`, `report-generate`, `report-get` API 테스트
- 신규: `DiagnosisPage`, `ReportPage`, `InterviewChat` 연습 모드 컴포넌트 테스트
- DB 오류 TC 전 route에 추가
- Playwright e2e: 실전 모드 + 연습 모드 전체 플로우 녹화

