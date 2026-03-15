# [#86] feat: 연습 모드 UI 전체 구현 — 모드 선택·즉각 피드백·재답변 루프 (siw) — 구현 계획

> 작성: 2026-03-15 | 최종 업데이트: 2026-03-15

---

## 완료 기준

- [x] `QuestionList.tsx` — "면접 바로 시작" 버튼이 **실전 모드 / 연습 모드 선택 UI**로 교체됨 (각 카드에 모드 설명 포함)
- [x] `POST /api/practice/feedback` Next.js route — 엔진 프록시, 200/400/500 처리, timeout 30s
- [x] `InterviewChat.tsx` — 연습 모드 시 답변 제출 후 피드백 카드 표시 (score·good/improve·keywords·improvedAnswerGuide)
- [x] `InterviewChat.tsx` — "다시 답변하기" 버튼 → `previousAnswer` 포함 재호출 → `comparisonDelta` (scoreDelta·improvements) 표시
- [x] `InterviewChat.tsx` — 재답변 피드백 확인 후 "다음 질문으로" 버튼으로 흐름 계속
- [x] `Prisma InterviewSession` — `interviewMode String @default("real")` 필드 추가 + 마이그레이션
- [x] `Sidebar.tsx` — "면접" 탭 activeCheck에 `/interview/new` 경로 포함
- [x] vitest: `practice-feedback-route.test.ts` (API 4케이스) + `interview-chat.test.tsx` 연습 모드 케이스 6개 추가

---

## 현재 상태 분석

### 기존 코드 파악
- `QuestionList.tsx`: 단일 "면접 바로 시작" 버튼 → `POST /api/interview/start` 직접 호출
- `InterviewChat.tsx`: 순수 display 컴포넌트 (history + currentQuestion + sessionComplete)
- `interview/[sessionId]/page.tsx`: answer 제출 → `/api/interview/answer` → nextQuestion 업데이트
- `interview/new/page.tsx`: 이력서 선택 → 면접 시작 (3-step Client Component, 모드 선택 없음)
- `Sidebar.tsx`: 4탭 (대시보드/내 이력서/면접/성장 추이) — `/interview/new` activeCheck 누락
- `prisma/schema.prisma`: `InterviewSession`에 `interviewMode` 필드 없음
- `engine/.ai.md` `/api/practice/feedback` 엔드포인트: 입력 `{question, answer, previousAnswer?}` → 출력 `{score, feedback:{good,improve}, keywords, improvedAnswerGuide, comparisonDelta?}`

### 핵심 설계 결정
1. **모드 전달**: sessionStorage `interview-mode-{sessionId}` 키로 저장 (기존 `interview-first-{sessionId}` 패턴 참고)
2. **연습 모드 흐름**: 답변 제출 → `/api/practice/feedback` 호출 → 피드백 카드 표시 → (다시 답변하기|다음 질문으로) 분기
3. **재답변**: `previousAnswer` 포함 재호출 → `comparisonDelta` 표시 후 "다음 질문으로"만 표시
4. **interview/start API**: 기존 API 변경 없이 sessionStorage로만 모드 전달

---

## 구현 결과

### Worker 1: Foundation (Types + Prisma + API Route + API Test) ✅

#### T1. `src/lib/types.ts` — 타입 추가 ✅
```ts
export type InterviewMode = "real" | "practice";
export type PracticeFeedback = {
  score: number;
  feedback: { good: string[]; improve: string[] };
  keywords: string[];
  improvedAnswerGuide: string;
  comparisonDelta?: { scoreDelta: number; improvements: string[] } | null;
};
```

#### T2. `prisma/schema.prisma` — interviewMode 필드 추가 ✅
```prisma
model InterviewSession {
  interviewMode   String   @default("real")   // ← 신규
}
```
마이그레이션: `prisma/migrations/20260315_add_interview_mode/migration.sql`
`prisma db push`로 Supabase 원격 DB 동기화 완료

#### T3. `src/app/api/practice/feedback/route.ts` — 엔진 프록시 생성 ✅
- `{ question, answer, previousAnswer? }` → `ENGINE_BASE_URL/api/practice/feedback`
- AbortSignal.timeout(30000), 200/400/500 처리

#### T4. `tests/api/practice-feedback-route.test.ts` — API 테스트 4케이스 ✅

---

### Worker 2: UI (QuestionList + interview/new + Sidebar) ✅

#### T5. `QuestionList.tsx` — 모드 선택 카드 UI ✅
- `data-testid="mode-real"` / `data-testid="mode-practice"` 카드
- 카드 클릭 → `handleStartInterview(mode)` → sessionStorage 저장

#### T6. `src/app/(app)/interview/new/page.tsx` — 모드 선택 step 추가 ✅
- 이력서 선택 후 실전/연습 모드 선택 카드 표시
- `data-testid="start-interview"` 시작 버튼 추가
- handleStart에 selectedMode 포함, sessionStorage 저장

#### T7. `Sidebar.tsx` — activeCheck 수정 ✅
- `/interview/` → `/interview` 로 변경해 `/interview/new` 경로도 active 처리

---

### Worker 3: InterviewChat + Session Page + UI Tests ✅

#### T8. `InterviewChat.tsx` — 연습 모드 피드백 UI ✅
추가 props:
```ts
interviewMode?: InterviewMode;
practiceFeedback?: PracticeFeedback | null;
onRetryAnswer?: () => void;
onNextQuestion?: () => void;
isRetried?: boolean;
practiceAnswer?: string;  // 제출한 답변 버블 표시용
```

피드백 카드: score 바, good/improve 리스트, keywords 태그, improvedAnswerGuide, comparisonDelta (재답변 후)

#### T9. `src/app/(app)/interview/[sessionId]/page.tsx` — 연습 모드 연동 ✅
- `interviewMode`, `practiceFeedback`, `isRetried`, `lastAnswer`, `practiceAnswer`, `fetchingFeedback` state 추가
- sessionStorage에서 모드 읽기
- practice 모드: 답변 → `/api/practice/feedback` → 피드백 표시 (textarea 숨김)
- 다시 답변하기: `isRetried=true`, 피드백 유지, textarea 재표시
- 다음 질문으로: `/api/interview/answer` 호출 → nextQuestion

#### T10. `tests/ui/interview-chat.test.tsx` — 연습 모드 케이스 6개 추가 ✅

---

## 추가 버그 수정 (이슈 진행 중 발견)

### `/resumes` 페이지 정리
- 헤더 "새 이력서" 버튼 제거 (중복)
- 빈 상태: 인라인 UploadForm 표시 (`showUpload` toggle)
- `UploadForm.tsx`: `hideTitle?: boolean` prop 추가 — 인라인 렌더 시 "자소서 분석" 헤딩 숨김
- 버튼 텍스트 "질문 생성" → "이력서 분석"

### DB 연결 수정
- `prisma.ts`: `PrismaPg` 어댑터에 `DIRECT_URL`(port 5432) 사용 — pgbouncer Transaction 모드(port 6543) ECONNREFUSED 해결

### UX 개선
- 다시 답변하기 클릭 시 피드백 카드 유지 (기존: 피드백 제거)
- 피드백 카드 위에 "내 답변" 버블 표시 (`practiceAnswer` prop)

---

## 별도 이슈

- **#102** `fix(engine): practice feedback scoreDelta LLM 추정값 불일치` — 엔진에서 `score`와 `scoreDelta`를 독립 추정해 수치 불일치 발생. 수정 방향: `previousScore` 파라미터 추가 + 서버에서 `scoreDelta = newScore - previousScore` 계산.

---

## 파일 변경 목록

| 파일 | 변경 유형 | 상태 |
|------|----------|------|
| `src/lib/types.ts` | 수정 | ✅ |
| `prisma/schema.prisma` | 수정 | ✅ |
| `prisma/migrations/20260315_add_interview_mode/migration.sql` | 신규 | ✅ |
| `src/app/api/practice/feedback/route.ts` | 신규 | ✅ |
| `src/components/QuestionList.tsx` | 수정 | ✅ |
| `src/app/(app)/interview/new/page.tsx` | 수정 | ✅ |
| `src/components/Sidebar.tsx` | 수정 | ✅ |
| `src/components/InterviewChat.tsx` | 수정 | ✅ |
| `src/app/(app)/interview/[sessionId]/page.tsx` | 수정 | ✅ |
| `src/components/UploadForm.tsx` | 수정 (hideTitle, 버튼 텍스트) | ✅ |
| `src/app/(app)/resumes/page.tsx` | 수정 (인라인 업로드, 헤더 정리) | ✅ |
| `src/lib/prisma.ts` | 수정 (DIRECT_URL) | ✅ |
| `tests/api/practice-feedback-route.test.ts` | 신규 | ✅ |
| `tests/ui/interview-chat.test.tsx` | 수정 | ✅ |
| `tests/e2e/practice-mode.spec.ts` | 신규 | ✅ |
| `services/siw/.ai.md` | 수정 | ✅ |
