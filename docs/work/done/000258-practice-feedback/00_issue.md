# feat: [siw] 연습모드에서 피드백 비표시 — 실전모드에서만 피드백 노출

## 완료 기준
- [x] `interviewMode === "practice"`일 때 `practiceFeedback` UI가 렌더링되지 않는다
- [x] `interviewMode === "real"`일 때 피드백이 정상적으로 표시된다
- [x] 기존 연습모드 재시도(retry) 흐름은 정상 동작한다

---

## 작업 내역
- `services/siw/src/app/(siw)/interview/[sessionId]/page.tsx`: practice 모드 handleSubmit에서 피드백 API 호출 제거, 다음 질문으로 바로 진행
- `InterviewChat.tsx`: 피드백 UI 렌더링 조건을 `interviewMode === "real"`로 변경
- `tests/ui/interview-chat.test.tsx`: practice 모드 피드백 비표시, real 모드 피드백 표시 테스트 추가
