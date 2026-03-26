# [#258] feat: 연습모드에서 피드백 비표시 — 구현 계획

> 작성: 2026-03-26

---

## 완료 기준

- [x] practice 모드에서 피드백 UI 비표시
- [x] real 모드에서 피드백 정상 표시
- [x] 테스트 업데이트

---

## 구현 계획

1. `page.tsx`: practice 모드 handleSubmit에서 피드백 API 호출 제거, real 모드처럼 바로 다음 질문 진행
2. `InterviewChat.tsx`: 피드백 UI 렌더링 조건을 `interviewMode === "real"`로 변경
3. 테스트 업데이트: practice 모드에서 피드백 미표시, real 모드에서 표시 확인
