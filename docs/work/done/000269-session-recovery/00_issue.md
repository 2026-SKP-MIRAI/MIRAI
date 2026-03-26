# chore: [siw] 면접 세션 중단 복구 불가 수정 — sessionStorage 초기화 + 네트워크 끊김 대응

## 완료 기준
- [x] sessionStorage에 첫 질문이 없는 상태로 면접 페이지 접속 시 "면접이 중단되었습니다" 안내 + 처음부터 다시 시작 버튼 표시
- [x] SSE 스트리밍 중단(네트워크 오류) 시 에러 메시지와 "마지막 답변 다시 제출" 버튼 표시

---

## 작업 내역

1. interview/[sessionId]/page.tsx:
   - sessionStorage miss 시 sessionInterrupted 상태 설정, 중단 안내 UI + 재시작 버튼 렌더링
   - consumeAnswerStream: for await 루프를 try/catch로 감싸 네트워크 끊김 감지, 에러 메시지 표시
   - handleRetryLastAnswer: 마지막 제출 답변을 재전송하는 함수 추가
   - 에러 메시지에 "마지막 답변 다시 제출" 버튼 추가
2. 테스트: interview-session-recovery.test.tsx 2개 추가
