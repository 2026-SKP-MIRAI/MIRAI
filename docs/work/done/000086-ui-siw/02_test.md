# [#86] 테스트 현황

> 작성: 2026-03-15

---

## 테스트 결과 요약

| 구분 | 파일 | 케이스 | 결과 |
|------|------|--------|------|
| Unit/UI | `tests/ui/interview-chat.test.tsx` | 8개 | ✅ 전체 통과 |
| API | `tests/api/practice-feedback-route.test.ts` | 4개 | ✅ 전체 통과 |
| 기존 전체 | vitest run | 89개 | ✅ 전체 통과 |
| E2E | `tests/e2e/practice-mode.spec.ts` | 1개 | 작성 완료 (수동 실행) |

---

## Unit/UI 테스트 — `tests/ui/interview-chat.test.tsx`

### `describe("InterviewChat")` — 기존 2케이스
| # | 테스트명 | 검증 내용 |
|---|---------|----------|
| 1 | 페르소나 레이블과 질문 버블 렌더링 | `chat-message` 1개, `persona-label` "HR 담당자" 표시 |
| 2 | sessionComplete=true 시 완료 메시지 | `session-complete` testid 표시 |

### `describe("연습 모드 피드백")` — 신규 6케이스
| # | 테스트명 | 검증 내용 |
|---|---------|----------|
| 1 | 피드백 카드 렌더링: feedback-score testid 표시 | `feedback-score` → "85점" 텍스트 |
| 2 | good/improve 리스트 렌더링 | `feedback-good`, `feedback-improve` 존재 |
| 3 | isRetried=false: 다시 답변하기 버튼 표시 | `btn-retry`, `btn-next-question` 둘 다 존재 |
| 4 | isRetried=true: 다시 답변하기 버튼 숨김 | `btn-retry` 없음, `btn-next-question`만 존재 |
| 5 | comparisonDelta 있을 때 feedback-delta 표시 | `feedback-delta` 존재 |
| 6 | real 모드에서 피드백 카드 미표시 | `feedback-score` 없음 |

---

## API 테스트 — `tests/api/practice-feedback-route.test.ts`

| # | 테스트명 | Mock 조건 | 기대 결과 |
|---|---------|----------|----------|
| 1 | 200 — previousAnswer 없음 (comparisonDelta=null) | 엔진 200 응답 | `{ score, feedback, keywords, improvedAnswerGuide, comparisonDelta: null }` |
| 2 | 200 — previousAnswer 있음 (comparisonDelta 포함) | 엔진 200 응답 | `comparisonDelta: { scoreDelta, improvements }` 포함 |
| 3 | 400 — 잘못된 요청 | 엔진 400 응답 | `{ message: "..." }` status 400 |
| 4 | 500 — 엔진 에러 | fetch throw | `{ message: "피드백 생성에 실패했습니다." }` status 500 |

---

## E2E 테스트 — `tests/e2e/practice-mode.spec.ts`

### 실행 방법
```bash
# Next.js 서버(port 3001) + 엔진(port 8000) 실행 상태에서
cd services/siw
npx playwright test tests/e2e/practice-mode.spec.ts --headed
```
영상 저장 위치: `test-results/practice-mode.spec.ts-chromium/video.webm`

### 테스트 시나리오: 기존 이력서 선택 → 연습 모드 전체 플로우

| 단계 | 액션 | 검증 |
|------|------|------|
| 1 | `/resumes` 접속 | — |
| 2 | "이 이력서로 면접" 클릭 | 링크 visible 확인 |
| 3 | `/interview/new` 진입 | URL 매칭 |
| 4 | `mode-practice` 클릭 | testid visible 확인 |
| 5 | `start-interview` 클릭 (LLM 호출) | — |
| 6 | `/interview/[sessionId]` 진입 | URL 매칭, `chat-message` visible |
| 7 | 첫 답변 입력 + 제출 | `answer-input` fill + click |
| 8 | AI 피드백 카드 표시 대기 | `feedback-score` visible (60s timeout) |
| 9 | "내 답변" 버블 표시 확인 | text="내 답변" visible |
| 10 | `feedback-good`, `feedback-improve` 확인 | testid visible |
| 11 | "다시 답변하기" 클릭 | `btn-retry` click |
| 12 | 피드백 유지 + 입력창 재표시 확인 | `feedback-score` + `answer-input` visible |
| 13 | 개선 답변 입력 + 제출 | fill + click |
| 14 | 재답변 피드백 + `comparisonDelta` 확인 | `feedback-delta` visible (60s timeout) |
| 15 | "다음 질문으로" 클릭 | `btn-next-question` click |
| 16 | 피드백 사라지고 다음 질문 표시 | `feedback-score` not visible, `answer-input` visible |

전체 timeout: 300초 (LLM 호출 포함)

---

## 알려진 이슈

| 이슈 | 내용 | 관련 이슈 |
|------|------|----------|
| scoreDelta 불일치 | 재답변 시 `comparisonDelta.scoreDelta`가 `newScore - previousScore`와 다름. LLM 독립 추정 문제 | [#102](https://github.com/2026-SKP-MIRAI/MIRAI/issues/102) |

---

## 실행 커맨드

```bash
# Unit + API 테스트 (vitest)
cd services/siw
npx vitest run

# E2E (Playwright, 영상 자동 녹화)
npx playwright test tests/e2e/practice-mode.spec.ts --headed

# 타입 검사
node_modules/.bin/tsc.cmd --noEmit
```
