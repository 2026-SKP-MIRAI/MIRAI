# feat: services/seung Phase 3 — 연습 모드 즉각 피드백 구현

## 사용자 관점 목표
seung 서비스에서 연습 모드를 선택하면 \"질문 → 답변 → 즉각 피드백 → 재답변 → 개선 비교 피드백 → 다음 질문\" 순환 구조로 의지적 반복 연습을 할 수 있다.

## 배경
엔진 이슈 #78(`POST /api/practice/feedback`)이 완료됐으며, seung Next.js 서비스가 이를 연동한다. Phase 1(패널 면접·꼬리질문)·Phase 2(8축 리포트) 완료 후 진행하는 Phase 3 작업이다.

**엔진 수정 금지** — 엔진 API 규격(`engine/.ai.md`)에 맞게 서비스 파트만 개발한다.

## 사전 검토 필수
- `engine/.ai.md` — `/api/practice/feedback` 계약 (timeout 30s, comparisonDelta 조건)
- `docs/specs/mirai/dev_spec.md` — 기능 05 명세
- `docs/specs/mirai/ux_flow.md` — 모드 구분 규칙, 채팅 화면 구성

## 설계 결정: 연습 모드에서 `/api/interview/answer` 호출 타이밍

연습 모드에서 첫 답변 직후 `/api/interview/answer`를 호출하면 엔진이 대화를 즉시 진행시켜 재답변 시 히스토리가 꼬인다. 따라서 아래 순서로 구현한다:

```
1. 사용자 답변 제출
   → POST /api/practice/feedback { question, answer }
   → 피드백 표시 (score, good/improve, keywords, guide)
   → "다시 답변하기" 버튼 표시

2. 사용자 재답변 제출
   → POST /api/practice/feedback { question, answer: 재답변, previousAnswer: 1차 답변 }
   → comparisonDelta 표시

3. "다음 질문" 버튼 클릭
   → POST /api/interview/answer (최종 답변으로 대화 진행)
```

실전 모드는 기존과 동일: `답변 제출 → /api/interview/answer → 다음 질문/꼬리질문`.

## 완료 기준
- [x] `lib/types.ts`에 `FeedbackDetail`, `ComparisonDelta`, `PracticeFeedbackRequest`, `PracticeFeedbackResponse` 타입 추가
- [x] `InterviewSession` Prisma 모델에 `interviewMode String @default("real")` 컬럼 추가 + `prisma migrate dev`
- [x] `POST /api/practice/feedback` 라우트: 엔진 포워딩 (`AbortSignal.timeout(40_000)`) → 엔진 400/500 그대로 반환
- [x] `POST /api/interview/start` 수정: `interviewMode` 수신 → DB 저장
- [x] `/resume` 페이지: 모드 선택 UI (실전 / 연습) → 선택 후 면접 시작
- [x] `InterviewChat` 컴포넌트: practice 모드 전용 피드백 블록(score·good/improve·keywords·guide) + "다시 답변하기" 버튼 + comparisonDelta 표시. `interviewMode` prop은 `"real"` 기본값으로 하위 호환 유지
- [x] Vitest 단위 + Playwright E2E 테스트 전체 통과 (기존 회귀 없음 포함)
- [x] `services/seung/.ai.md` 최신화

## 구현 플랜
1. **타입 정의** — `lib/types.ts`에 `FeedbackDetail`, `ComparisonDelta`, `PracticeFeedbackRequest`, `PracticeFeedbackResponse` 추가
2. **Prisma 스키마** — `InterviewSession`에 `interviewMode String @default("real")` 추가 + `prisma migrate dev`
3. **기존 테스트 mock 수정** — `interview-start.test.ts`, `interview-answer.test.ts`, `report-generate.test.ts`의 `mockPrisma` 반환 객체에 `interviewMode` 필드 추가 (기존 테스트 파손 방지)
4. **API 라우트 TDD**
   - `POST /api/practice/feedback` — body 검증 → 엔진 포워딩 (40s timeout) → 응답 반환
   - `POST /api/interview/start` 수정 — `interviewMode` 수신·저장
5. **Resume 페이지** — 면접 시작 버튼 → 모드 선택 UI (실전/연습) → `interviewMode` 전달
6. **Interview 페이지** — `interviewMode` 상태 + `practiceStep("idle"|"feedback"|"retry"|"done")` + `currentAnswer` 추적 + `handlePracticeFeedback` 핸들러
7. **InterviewChat 컴포넌트** — `interviewMode?: "real" | "practice"` prop 추가(기본 `"real"`), practice 전용 피드백 블록·"다시 답변하기" 버튼·comparisonDelta 섹션
8. **Playwright E2E** — 연습 모드 전체 플로우 (`test.setTimeout(120_000)` 이상)

## 개발 체크리스트
- [ ] 테스트 코드 포함 (Vitest unit + Playwright e2e, 기존 회귀 없음)
- [ ] 해당 디렉토리 `.ai.md` 최신화
- [ ] 불변식 위반 없음 (LLM 직접 호출 금지 — 엔진 경유만)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 서버 전용 (`NEXT_PUBLIC_` 금지)

---

## 작업 내역

### 신규 파일

- **`src/app/api/practice/feedback/route.ts`**: 엔진 포워딩 전용 라우트. `question`, `answer`, (선택)`previousAnswer`를 검증 후 엔진 `/api/practice/feedback`으로 전달. `AbortSignal.timeout(40_000)`, `maxDuration = 45` 설정. 엔진 응답 상태코드·바디를 그대로 반환.
- **`prisma/migrations/20260317041311_add_interview_mode/`**: `InterviewSession`에 `interviewMode String @default("real")` 컬럼 추가 마이그레이션.
- **`tests/api/practice-feedback.test.ts`**: `/api/practice/feedback` 단위 테스트 12개 (성공·비문자열 타입 검증·빈 문자열·ENGINE_BASE_URL 없음·엔진 400/500·non-JSON 응답 상태코드 보존).
- **`tests/e2e/practice-flow.spec.ts`**: API 모킹 기반 연습 모드 E2E 4케이스.
- **`tests/e2e/real-practice-flow.spec.ts`**: 실제 엔진+Supabase 연동 전체 플로우 E2E. 1/1 통과(56.5초).

### 수정 파일

- **`src/lib/types.ts`**: `FeedbackDetail`, `ComparisonDelta`, `PracticeFeedbackRequest`, `PracticeFeedbackResponse` 타입 추가. `InterviewStartRequest.interviewMode` union에 `'practice'` 추가.
- **`prisma/schema.prisma`**: `InterviewSession`에 `interviewMode String @default("real")` 추가.
- **`src/app/api/interview/start/route.ts`**: body에서 `interviewMode` 수신 → `prisma.interviewSession.create` 시 저장. 미전달 시 `'real'` 기본값.
- **`src/app/api/interview/session/route.ts`**: `select`·응답에 `interviewMode` 추가.
- **`src/app/resume/page.tsx`**: "면접 시작" 클릭 → 모드 선택 카드(실전/연습) 표시 → 선택 후 "확인" 버튼으로 진입하는 UX로 변경. 잘못 누를 위험 방지.
- **`src/app/interview/page.tsx`**: `interviewMode`, `practiceStep('idle'→'feedback'→'retry'→'done')`, `currentAnswer`, `practiceFeedback` 상태 추가. `handlePracticeFeedback`(피드백 요청), `handleRetry`(재답변), `handleNextQuestion`(다음 질문으로 진행) 핸들러 구현. `handleSubmit`에서 모드별 분기.
- **`src/components/InterviewChat.tsx`**: practice 전용 props(`interviewMode`, `practiceFeedback`, `practiceStep`, `onRetry`, `onNextQuestion`) 추가. 마지막 answer 메시지 직후 피드백 블록(점수·잘한점·개선할점·키워드·개선가이드·comparisonDelta) 렌더링. 기본값 `interviewMode='real'`로 하위 호환 유지.
- **`tests/api/interview-start.test.ts`**: `interviewMode='practice'` 저장 검증 케이스 추가.
- **`tests/components/InterviewChat.test.tsx`**: practice 모드 피드백 블록·재답변 버튼·comparisonDelta·실전 모드 미표시 케이스 4개 추가.

### 주요 버그 수정 (구현 중 발견)

- **isRetry 오판정**: 초기 구현에서 `isRetry = practiceStep === 'feedback'`으로 작성. `'feedback'` 단계에서 `AnswerInput`이 숨겨져 있어 함수 자체가 호출 불가한 상태였음. `practiceStep === 'retry'`로 수정.
- **타입 검증 강화**: `!question` 대신 `typeof question !== 'string'`으로 변경 — 숫자 등 비문자열 타입 전달 시 `.trim()` 호출 TypeError 방지.
- **non-JSON 응답 상태코드**: 엔진 응답 JSON 파싱 실패 시 500 하드코딩 → `engineResponse.status` 그대로 반환으로 수정.

