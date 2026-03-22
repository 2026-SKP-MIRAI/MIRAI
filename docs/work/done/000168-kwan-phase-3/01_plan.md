# [#168] feat: [kwan] Phase 3 — analyze 전환 + 기능 02·05·07 구현 (피드백·연습·리포트) — 구현 계획

> 작성: 2026-03-20
> 검증: 2026-03-20 (아키텍처·백엔드·TDD 3중 검증 완료)

---

## 완료 기준

### 1. 인프라 — analyze 전환 + targetRole 확정 + PDF 저장
- [x] `callEngineParse` → `callEngineAnalyze`로 변경; `/api/resume/analyze` 호출; 반환에 `targetRole` 포함
- [x] `callEngineQuestions(resumeText, targetRole)` — `{ resumeText, targetRole }` 전송
- [x] `POST /api/resume/questions` 라우트: analyze 응답에서 `targetRole` 추출 → questions에 전달
- [x] Prisma `Resume` 모델: `storageKey String?`, `inferredTargetRole String?` 컬럼 추가
- [x] Resume 생성 시 `inferredTargetRole` 저장; engine 질문 응답을 `questions` 필드에 업데이트
- [x] PDF 원본 저장 → `storageKey`에 경로 저장; 저장 실패해도 요청은 성공 (graceful degradation)
- [x] 기존 테스트 전체 업데이트: mock 이름 `/parse` → `/analyze` 전면 리네이밍

### 2. UX 플로우 — PDF 업로드 → targetRole 확정 → 자소서 진단 → 면접 시작
- [x] 메인 페이지: PDF 업로드 → engine `/analyze` 호출 → `targetRole` 표시 + 수정 input
- [x] targetRole 확정 버튼 클릭 시:
  - 포그라운드: `POST /api/resume/feedback` → 완료 후 `/diagnosis?resumeId=xxx` 이동
  - 백그라운드 (feedback 응답 대기 중): `POST /api/resume/questions` (질문 생성 + 기존 row 업데이트)
- [x] `/diagnosis` 페이지에 "면접 시작" 버튼 추가 → `/interview?resumeId=xxx` 이동 (모드 선택은 interview 페이지에서)
- [x] 질문 목록은 사용자에게 노출하지 않음 (백그라운드 처리)

### 3. 기능 02 — 이력서·자소서 피드백 (진단 5축 점수)
- [x] `POST /api/resume/feedback` 라우트: `{ resumeId, targetRole? }` 수신
- [x] `GET /api/resume/diagnosis?resumeId=xxx` 라우트: 저장된 `diagnosisResult` 반환; 404 처리
- [x] Prisma `Resume`: `diagnosisResult Json?` 추가
- [x] `engine-client.ts`: `callEngineResumeFeedback(resumeText, targetRole)` 추가
- [x] Zod: `ResumeFeedbackResponseSchema` (scores 5키, strengths, weaknesses, suggestions)
- [x] `diagnosisResult` DB 저장은 **await** 처리 — 저장 완료 후 응답 반환 (저장 실패 시에도 결과 반환)
- [x] UI `/diagnosis?resumeId=xxx` 페이지: 5축 점수 바, 강점/약점 목록, 개선 제안 카드, **"면접 시작" 버튼**
- [x] 테스트: happy path, resumeId 누락(400), resume 없음(404), 엔진 에러(500), 타임아웃, Zod 검증 실패(500), DB 저장 실패 → 200 (결과 반환)

### 4. 기능 05 — 연습 모드 즉각 피드백
- [x] `POST /api/practice/feedback` 라우트: `{ question, answer, previousAnswer? }`
- [x] Prisma `InterviewSession`: `interviewMode String @default("real")` 추가
- [x] `POST /api/interview/start`: `mode` 파라미터 수신 → `interviewMode` DB 저장 (engine에는 항상 `mode: "panel"` 전달)
- [x] `engine-client.ts`: `callEnginePracticeFeedback(question, answer, previousAnswer?)` 추가
- [x] Zod: `PracticeFeedbackResponseSchema` — `comparisonDelta`는 `.nullable().optional()`
- [x] UI: 모드 선택(실전/연습), 피드백 패널(점수·good/improve·키워드·가이드), "다시 답변하기" 버튼
- [x] 테스트: happy path, 필수 필드 누락(400), 타입 불일치(400), 타임아웃, previousAnswer 포함 시 comparisonDelta 확인

### 5. 기능 07 — 8축 역량 평가 리포트
- [x] Prisma `Report` 모델: `id`, `sessionId @unique` FK, `totalScore Int`, `scores Json`, `summary String`, `axisFeedbacks Json`, `createdAt`, **`@@map("reports")`**
- [x] `POST /api/report/generate`: `{ sessionId }`
- [x] `GET /api/report?reportId=xxx`: Report 조회, 404 처리
- [x] `engine-client.ts`: `callEngineReportGenerate(resumeText, history)` — **90s timeout**
- [x] Zod: `ReportGenerateResponseSchema` (totalScore, 8축 scores, summary, axisFeedbacks)
- [x] UI `/report?reportId=xxx` 페이지: totalScore, 8축 점수 바, summary, axisFeedbacks, 로딩("약 15초 소요")
- [x] `InterviewChat.tsx` 완료 상태에 "리포트 생성" 버튼 + 기존 테스트 업데이트
- [x] 테스트: happy path(201), 세션 미완료(400), history 비배열(500), history<5(422), 타임아웃, 중복(멱등 200), engine 422

### 6. 공통
- [x] `npm test` 전체 통과 (14파일 119개 TC)
- [x] `npm run build` 성공
- [x] `.ai.md` 업데이트

---

## 구현 계획

> **아키텍처:** 기존 kwan MVP 패턴(직접 route handler + engine-client + Prisma)을 유지. seung의 간결한 API 구현과 siw의 Supabase 스토리지 패턴 참고. 인증 없음(kwan 특성). TDD로 진행.
>
> **Tech Stack:** Next.js 16.1.6, Prisma 6, Vitest 4, Zod 4, @supabase/supabase-js

---

### Phase 1: Prisma 스키마 마이그레이션

**Task 1: Prisma 스키마 확장** (`prisma/schema.prisma`)

- [x] Resume 모델에 `storageKey String?`, `inferredTargetRole String?`, `diagnosisResult Json?` 추가 (기존 `@@map("resumes")` 유지)
- [x] InterviewSession에 `interviewMode String @default("real")`, `report Report?` 관계 추가 (기존 `@@map("interview_sessions")` 유지)
- [ ] Report 모델 신규 생성:
  ```prisma
  model Report {
    id            String           @id @default(cuid())
    sessionId     String           @unique
    session       InterviewSession @relation(fields: [sessionId], references: [id])
    totalScore    Int
    scores        Json
    summary       String
    axisFeedbacks Json
    createdAt     DateTime         @default(now())

    @@map("reports")
  }
  ```
  > ⚠️ `@@map("reports")` 필수 — 기존 kwan 컨벤션(`resumes`, `interview_sessions`) 유지
- [x] `npx prisma db push && npx prisma generate`
- [x] 기존 테스트 통과 확인

---

### Phase 2: 인프라 — analyze 전환 + PDF 저장

**Task 2: engine-client 확장** (`src/lib/engine-client.ts`)

- [x] `callEngineParse` → `callEngineAnalyze`로 이름 변경, 엔드포인트 `/api/resume/analyze`로 변경 (timeout: 30s 유지)
  - **파라미터 타입**: `(file: Blob)` — `File extends Blob`이므로 기존 File 전달도 호환
- [x] `callEngineQuestions(resumeText, targetRole)` — targetRole 파라미터 추가
  - `targetRole`이 빈 문자열인 경우 필드 생략: `body: JSON.stringify({ resumeText, ...(targetRole ? { targetRole } : {}) })`
- [x] `callEngineResumeFeedback(resumeText, targetRole)` — 40s timeout
- [x] `callEnginePracticeFeedback(question, answer, previousAnswer?)` — 40s timeout
- [x] `callEngineReportGenerate(resumeText, history)` — **90s timeout**

**Task 3: Supabase 클라이언트 + PDF 스토리지 유틸**

- [x] `src/lib/supabase.ts` — `createServiceClient()` (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
  ```ts
  import { createClient } from '@supabase/supabase-js'
  export function createServiceClient() {
    return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  }
  ```
- [x] `src/lib/resume-storage.ts` — `uploadResumePdf(buffer, originalFileName): Promise<string>`
  - storageKey: `uploads/${uuid}.pdf` (인증 없으므로 userId 없음)
  - 실패 시 `throw new Error(...)` — 호출부에서 `.catch()` 처리
- [x] `npm install --save @supabase/supabase-js`

**Task 4: POST /api/resume/questions — analyze 전환 + questions DB 저장 + PDF 저장** (TDD)

**⚠️ 구현 순서 주의:**
```
Step 1: buffer 먼저 추출 (file.arrayBuffer 이중 소비 방지)
  const buffer = Buffer.from(await file.arrayBuffer())
  const fileForEngine = new Blob([buffer], { type: file.type })

Step 2: engine /analyze 호출
  const analyzeRes = await callEngineAnalyze(fileForEngine)
  const { resumeText, targetRole } = analyzeData

Step 3: questions + DB 저장 병렬
  const [qRes, resume] = await Promise.all([
    callEngineQuestions(resumeText, targetRole || undefined),
    prisma.resume.create({ data: { resumeText, questions: [], inferredTargetRole: targetRole ?? null } }).catch(...)
  ])

Step 4: engine 질문 응답을 DB에 저장 (fire-and-forget)
  if (resume && qRes.ok) {
    const qData = await qRes.clone().json().catch(() => null)
    if (qData) {
      void prisma.resume.update({ where: { id: resume.id }, data: { questions: qData } })
        .catch((err) => console.error('[resume/questions] questions DB update failed', err))
    }
  }

Step 5: PDF 저장 비동기 체인 (fire-and-forget)
  if (resume) {
    void uploadResumePdf(buffer, file.name)
      .then((storageKey) => prisma.resume.update({ where: { id: resume.id }, data: { storageKey } }))
      .catch((err) => console.error('[resume/questions] PDF storage failed', err))
  }
```
> questions DB 저장은 면접 시작 시 `questionsQueue` 조회를 위해 필수. storageKey와 별도 체인으로 처리.

- `maxDuration = 70` 유지 (analyze 30s + questions 30s 최악의 경우 60s, 여유 유지)

**테스트 업데이트 범위 (`tests/api/resume-questions.test.ts`):**

1. `vi.hoisted` mock 블록:
   ```ts
   const { mockCallEngineAnalyze, mockCallEngineQuestions, mockUploadResumePdf, mockPrisma } = vi.hoisted(() => ({
     mockCallEngineAnalyze: vi.fn(),
     mockCallEngineQuestions: vi.fn(),
     mockUploadResumePdf: vi.fn(),
     mockPrisma: {
       resume: { create: vi.fn(), update: vi.fn() },
     },
   }))
   ```
2. `vi.mock('@/lib/engine-client')`: `callEngineParse` → `callEngineAnalyze`
3. `vi.mock('@/lib/resume-storage', () => ({ uploadResumePdf: mockUploadResumePdf }))` 신규
4. `beforeEach` 기본 응답: `{ resumeText: '...', extractedLength: 100, targetRole: '백엔드 엔지니어' }`
5. 정상 흐름 검증:
   ```ts
   expect(mockCallEngineAnalyze).toHaveBeenCalledTimes(1)
   expect(mockCallEngineQuestions).toHaveBeenCalledWith('...', '백엔드 엔지니어')
   expect(mockPrisma.resume.create).toHaveBeenCalledWith({
     data: expect.objectContaining({ questions: [], inferredTargetRole: '백엔드 엔지니어' }),
   })
   // questions DB update 검증
   await Promise.resolve()
   expect(mockPrisma.resume.update).toHaveBeenCalledWith(
     expect.objectContaining({ data: expect.objectContaining({ questions: expect.any(Object) }) })
   )
   ```
6. 신규 테스트: `'PDF 저장 실패해도 요청 성공 → 200'`
7. 신규 테스트: `'PDF 저장 성공 시 storageKey DB 업데이트'`

---

### Phase 3: 기능 02 — 이력서 피드백

**Task 5: Zod 스키마 + 타입 — ResumeFeedback**

- [x] `schemas.ts`: `ResumeFeedbackScoresSchema` (5축), `SuggestionSchema`, `ResumeFeedbackResponseSchema`
- [x] `types.ts`: `FeedbackScores`, `SuggestionItem` 인터페이스 추가

**Task 6: POST /api/resume/feedback** (TDD)

테스트 케이스:
1. resumeId 누락 → 400
2. resume 없음 → 404
3. 정상 흐름 (targetRole 제공) → 200 + engine 응답 반환 + DB 저장
4. targetRole 미제공 + inferredTargetRole → inferredTargetRole 사용
5. targetRole 미제공 + inferredTargetRole 없음 → '미지정 직무' 사용
6. 엔진 오류 → 500
7. 타임아웃 → 500 + 타임아웃 메시지
8. DB update 실패 → 200 (결과는 반환)
9. **Zod 검증 실패 (scores 형식 불일치) → 500**

route 핵심:
- `effectiveTargetRole = targetRole?.trim() || resume.inferredTargetRole || '미지정 직무'`
- 엔진 호출 → Zod 검증 → **`await prisma.resume.update(...).catch(err => console.error(...))`**
  > ⚠️ fire-and-forget이 아닌 await 필수: /diagnosis 페이지 접근 시 diagnosisResult가 없으면 404 발생
  > `.catch()`로 저장 실패해도 결과는 반환
- 응답 반환
- `maxDuration = 45`

**Task 7: GET /api/resume/diagnosis** (TDD)

테스트 케이스:
1. resumeId 누락 → 400
2. resume 없음 → 404
3. diagnosisResult 없음 → 404 `'진단 결과가 없습니다.'`
4. 정상 → 200 + diagnosisResult

**Task 8: /diagnosis 페이지 UI**

- `src/app/diagnosis/page.tsx` — `'use client'` + `useSearchParams()`
- `GET /api/resume/diagnosis?resumeId=` 호출
- 5축 점수 바 (한국어 레이블: 구체성, 성과 명확성, 논리 구조, 직무 정합성, 차별성)
- 강점(초록 배지) / 약점(빨간 배지) / 개선 제안 카드
- **"면접 시작" 버튼** — `/interview?resumeId=xxx` 이동 (모드 선택은 interview 페이지에서 처리)
  - interview 페이지: 실전/연습 모드 선택 → `POST /api/interview/start { resumeId, mode }` 호출

테스트 (`tests/components/DiagnosisPage.test.tsx`):
- fetch mock: `vi.stubGlobal('fetch', ...)`
- `useSearchParams` mock: `vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('resumeId=test-id'), useRouter: () => ({ push: vi.fn() }) }))`
- 5축 점수 바, 강점/약점, 개선 제안 카드 렌더링 확인
- "면접 시작" 버튼 렌더링 + 클릭 → `/interview?resumeId=test-resume-id` 이동 확인
- 로딩 상태, 에러 상태 확인

**Task 4.5: 메인 페이지 플로우 — targetRole 확정 UI**

- `src/app/page.tsx` 수정: PDF 업로드 후 analyze 응답 수신 → targetRole 표시 + 수정 input + "확정" 버튼
- 확정 버튼 클릭 시:
  1. `POST /api/resume/feedback { resumeId, targetRole }` 호출 (포그라운드 — 완료까지 대기)
  2. `POST /api/resume/questions { file, targetRole }` 호출 (백그라운드 — 응답 대기 불필요)
  3. feedback 완료 → `/diagnosis?resumeId=xxx` 이동
- `QuestionList.tsx` 컴포넌트는 사용자에게 노출하지 않음

> **순서 이유**: feedback이 포그라운드인 이유 — diagnosisResult DB 저장이 await이므로 /diagnosis 접근 전 반드시 완료되어야 함. questions는 백그라운드여도 면접 시작 전까지 완료될 여유가 있음.

---

### Phase 4: 기능 05 — 연습 모드

**Task 9: POST /api/practice/feedback** (TDD)

Zod 스키마 (`schemas.ts`):
```ts
export const PracticeFeedbackResponseSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.object({
    good: z.array(z.string()),
    improve: z.array(z.string()),
  }),
  keywords: z.array(z.string()),
  improvedAnswerGuide: z.string(),
  comparisonDelta: z.object({
    scoreDelta: z.number(),
    improvements: z.array(z.string()),
  }).nullable().optional(),
})
```

테스트 케이스:
1. question 누락 → 400 `'question과 answer가 필요합니다.'`
2. answer 누락 → 400
3. answer 공백 → 400
4. **question이 string이 아닌 타입 (null, number) → 400**
5. 정상 흐름 (previousAnswer 없음) → 200
6. 정상 흐름 (previousAnswer 있음) → 200 + comparisonDelta
7. 엔진 오류 → 500
8. 타임아웃 → 500 + 타임아웃 메시지

- stateless — DB 불필요, `maxDuration = 45`

**Task 10: interview/start mode 파라미터 + session 응답 확장**

- [x] `interview/start`: body에 `mode?: string` 추가
  - `interviewMode = mode === 'practice' ? 'practice' : 'real'` → DB 저장
  - engine에는 항상 `mode: 'panel'` 전달 (engine 계약 불변)
- [x] `interview/session`: 응답에 `interviewMode` 필드 추가
- [x] `src/app/interview/page.tsx` 수정: 면접 시작 전 모드 선택 UI
  - "실전 모드" / "연습 모드" 버튼 → `POST /api/interview/start { resumeId, mode }` 호출
  - 연습 모드: 답변 후 `/api/practice/feedback` 호출 → 피드백 패널 + "다시 답변하기"

테스트 업데이트 (`tests/api/interview-start.test.ts`):
- `'mode=practice → interviewMode=practice 저장'`
- `'mode 미제공 → interviewMode=real 기본값'`
- `prisma.interviewSession.create` 호출 시 `interviewMode` 포함 확인

테스트 업데이트 (`tests/api/interview-session.test.ts`):
- 기존 정상 케이스에 `expect(body.interviewMode).toBe('real')` 추가

---

### Phase 5: 기능 07 — 8축 리포트

**Task 11: Zod 스키마 + 타입 — Report**

- [x] `schemas.ts`: `AxisScoresSchema` (8축), `AxisFeedbackSchema`, `ReportGenerateResponseSchema`
- [x] `types.ts`: `AxisScores`, `AxisFeedback` 인터페이스 추가

**Task 12: POST /api/report/generate** (TDD)

**⚠️ history 검증 순서 (반드시 준수):**
```ts
const rawHistory = session.history as unknown
// ① 배열 타입 검사 먼저 → 실패 시 500 (DB 오염 방어)
if (!Array.isArray(rawHistory)) {
  return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
}
// ② 길이 검사 → 실패 시 422 (사용자 피드백)
if (rawHistory.length < 5) {
  return Response.json({ error: '답변이 부족합니다. 더 많은 질문에 답변해 주세요.' }, { status: 422 })
}
```
> 두 조건을 `||`로 묶으면 비배열일 때도 422 반환 — 반드시 분리

테스트 케이스:
1. sessionId 누락 → 400
2. session 없음 → 404
3. session 미완료 → 400 `'면접이 아직 완료되지 않았습니다.'`
4. **history가 배열이 아님 (null/object) → 500**
5. history < 5 → 422
6. 정상 흐름 → 201 + reportId
7. 기존 리포트 존재 (멱등) → 200 + 기존 reportId
8. P2002 동시 요청 → 200 fallback
9. engine timeout → 500
10. engine 422 → 422 전달

route 핵심:
- 멱등성: `findFirst` → `create` → P2002 `findUnique` fallback
- history에서 `questionType` 제거 후 엔진 전달
- `maxDuration = 100`

**Task 13: GET /api/report** (TDD)

테스트 케이스:
1. reportId 누락 → 400
2. report 없음 → 404
3. 정상 → 200 + 전체 필드, `expect(body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)` ISO 형식 확인

**Task 14: UI — /report 페이지 + InterviewChat 리포트 버튼**

`src/app/report/page.tsx`:
- totalScore (큰 원형/숫자)
- 8축 점수 바 (한국어 레이블: 의사소통, 문제해결, 논리적 사고, 직무 전문성, 조직 적합성, 리더십, 창의성, 성실성)
- summary 텍스트
- axisFeedbacks 카드 (strength/improvement 구분)
- 로딩: `"리포트 생성 중... (약 15초 소요)"`

`InterviewChat.tsx` 수정:
- 완료 화면에 "리포트 생성" 버튼 추가
- 클릭 → POST `/api/report/generate` → `/report?reportId=xxx` 이동
- 로딩 중 버튼 비활성화 + `"생성 중..."` 표시

`tests/components/InterviewChat.test.tsx` 수정:
- `'완료 화면에서 리포트 생성 버튼 렌더 확인'`
- `'리포트 생성 버튼 클릭 → POST /api/report/generate 호출'`
- `'리포트 생성 로딩 중 버튼 비활성화'`
- `'리포트 생성 성공 → /report?reportId=xxx 이동'`

---

### Phase 6: 마무리

**Task 15: 전체 테스트 + 빌드 + .ai.md 최신화**

- [x] `npm test` — 전체 테스트 통과 (14파일 119개 TC)
- [x] `npm run build` — TypeScript strict 빌드 성공
- [x] `services/kwan/.ai.md` 업데이트: Phase 3 구현 내역, 새 API 라우트, Report 모델, Supabase 환경변수

---

## 핵심 설계 결정

| 결정 | 근거 |
|------|------|
| targetRole 사용자 확정 단계 | analyze 추출값을 사용자가 검토/수정 후 확정 — 잘못된 직무로 질문·진단이 생성되는 것 방지 |
| feedback 포그라운드, questions 백그라운드 | feedback의 diagnosisResult가 await으로 저장되므로 /diagnosis 접근 전 반드시 완료 필요; questions는 면접 시작 전까지 완료될 여유 있음 |
| diagnosisResult DB 저장: await + catch | fire-and-forget 금지 — /diagnosis 접근 전 저장 완료 보장. 단 .catch()로 저장 실패해도 응답 반환 |
| resume.questions DB 저장 (fire-and-forget) | interview/start 시 questionsQueue 조회 위해 필수. storageKey 저장과 별도 체인 |
| history 검증 분리: 비배열→500, 길이<5→422 | 비배열은 DB 오염 (서버 에러), 길이 부족은 사용자 행동 (클라이언트 에러) — 에러 분류 정확성 |
| 질문 목록 미노출, 진단결과를 메인 화면으로 | 사용자는 자소서 분석결과를 보고 면접 준비 상태를 확인한 뒤 면접 시작 결정 |
| /diagnosis에 "면접 시작" 버튼 | 진단결과 확인 → 면접 시작의 자연스러운 플로우 |
| PDF storageKey: `uploads/${uuid}.pdf` | resumeId와 독립적, userId 없음(인증 없음) |
| buffer 먼저 추출, Blob 재생성 | `file.arrayBuffer()` 이중 소비 방지 |
| engine에 항상 `mode: "panel"` | engine 계약 불변. interviewMode는 DB 저장용으로만 사용 |
| targetRole 폴백: 제공값 → inferredTargetRole → '미지정 직무' | 이슈 AC 명시 |
| 인증 없음 | kwan 특성. resumeId가 cuid로 예측 불가능하여 수용 가능한 리스크 |
| Report @@map("reports") | 기존 kwan 컨벤션(`resumes`, `interview_sessions`) 준수 |
| Timeout: analyze 30s, feedback 40s, practice 40s, report 90s | engine/.ai.md 계약 준수 |
| maxDuration: questions=70, feedback=45, practice=45, report=100 | analyze(30s)+questions(30s) 최악 60s + 여유 |

## 수정/생성 파일 맵

| 파일 | 액션 | 태스크 |
|------|------|--------|
| `prisma/schema.prisma` | 수정 | 1 |
| `src/lib/engine-client.ts` | 수정 | 2 |
| `src/lib/supabase.ts` | 신규 | 3 |
| `src/lib/resume-storage.ts` | 신규 | 3 |
| `src/app/api/resume/questions/route.ts` | 수정 | 4 |
| `tests/api/resume-questions.test.ts` | 수정 | 4 |
| `src/app/page.tsx` | **수정** | 4.5 |
| `src/domain/interview/schemas.ts` | 수정 | 5, 9, 11 |
| `src/domain/interview/types.ts` | 수정 | 5, 11 |
| `src/app/api/resume/feedback/route.ts` | 신규 | 6 |
| `tests/api/resume-feedback.test.ts` | 신규 | 6 |
| `src/app/api/resume/diagnosis/route.ts` | 신규 | 7 |
| `tests/api/resume-diagnosis.test.ts` | 신규 | 7 |
| `src/app/diagnosis/page.tsx` | 신규 | 8 |
| `tests/components/DiagnosisPage.test.tsx` | 신규 | 8 |
| `src/app/api/practice/feedback/route.ts` | 신규 | 9 |
| `tests/api/practice-feedback.test.ts` | 신규 | 9 |
| `src/app/api/interview/start/route.ts` | 수정 | 10 |
| `src/app/api/interview/session/route.ts` | 수정 | 10 |
| `src/app/interview/page.tsx` | **수정** | 10 |
| `tests/api/interview-start.test.ts` | 수정 | 10 |
| `tests/api/interview-session.test.ts` | 수정 | 10 |
| `src/app/api/report/generate/route.ts` | 신규 | 12 |
| `tests/api/report-generate.test.ts` | 신규 | 12 |
| `src/app/api/report/route.ts` | 신규 | 13 |
| `tests/api/report-get.test.ts` | 신규 | 13 |
| `src/app/report/page.tsx` | 신규 | 14 |
| `src/components/InterviewChat.tsx` | 수정 | 14 |
| `tests/components/ReportPage.test.tsx` | 신규 | 14 |
| `tests/components/InterviewChat.test.tsx` | **수정** | 14 |
| `services/kwan/.ai.md` | 수정 | 15 |

> 모든 경로는 `services/kwan/` 기준 상대 경로
