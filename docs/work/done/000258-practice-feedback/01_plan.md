# [#258] feat: 연습모드에서 피드백 비표시 — 실전모드에서만 피드백 노출 — 구현 계획

> 작성: 2026-03-26

---

## 배경

연습모드(practice) 면접에서도 실전모드와 동일하게 피드백이 표시되어, 연습모드의 의도(즉시 답변 흐름, 빠른 반복 연습)가 구현되지 않았다.

## 완료 기준

- [x] `interviewMode === "practice"`일 때 피드백 UI가 렌더링되지 않는다
- [x] `interviewMode === "real"`일 때 피드백이 정상적으로 표시된다
- [x] 기존 연습모드 재시도 흐름은 정상 동작한다

---

## 구현 계획

### 변경 대상

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/(app)/interview/[sessionId]/page.tsx` | practice 모드 handleSubmit 재작성 |
| `services/siw/src/components/InterviewChat.tsx` | 피드백 UI 렌더링 조건 변경 |
| `services/siw/tests/ui/interview-chat.test.tsx` | 테스트 재구성 |

### 구현 상세

**page.tsx — practice 모드 handleSubmit 변경:**
- 기존: `/api/practice/feedback` 호출 → `setFetchingFeedback`, `setPracticeFeedback`, `setPracticeAnswer` 상태 설정
- 변경: `/api/interview/answer` 스트리밍 호출 → `consumeAnswerStream(res.body)` → 다음 질문으로 바로 진행
- practice 모드가 real 모드와 동일한 답변 제출 흐름을 사용하게 됨

**InterviewChat.tsx — 렌더링 조건 변경:**
- 피드백 스피너, 답변 버블, 피드백 카드, 재답변 버튼의 렌더링 조건:
  - 기존: `interviewMode === "practice"` → 표시
  - 변경: `interviewMode === "real"` → 표시
- `isRetried`, `lastAnswer`, `lastScore` 상태는 real 모드에서만 유효

### 테스트 전략
- practice 모드: 피드백 카드 미렌더링 확인
- real 모드: 피드백 카드 렌더링 + 재답변 버튼 + delta 표시 확인
- 총 9개 테스트
