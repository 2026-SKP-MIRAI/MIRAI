# fix: [siw] 면접 세션 중단 복구 불가 수정 — sessionStorage 초기화 + 네트워크 끊김 대응

Issue #269

## 배경
브라우저를 닫고 재접속하면 sessionStorage가 비어 있어 면접 첫 질문을 불러올 수 없었다. 또한 SSE 스트림이 네트워크 오류로 끊겼을 때 `consumeAnswerStream` 내부에서 에러를 처리하지 않아 사용자가 재시도할 방법이 없었다.

## 완료 기준
- [x] sessionStorage에 첫 질문이 없는 상태로 면접 페이지 접속 시 "면접이 중단되었습니다" 안내 + 처음부터 다시 시작 버튼 표시
- [x] SSE 스트리밍 중단(네트워크 오류) 시 에러 메시지와 "마지막 답변 다시 제출" 버튼 표시

---

## 코드 리뷰

### 검토 결과
특이사항 없음.

- `sessionInterrupted` + `lastSubmittedAnswer` 두 상태로 각각 세션 복구 안내와 재시도 답변을 관리 — 역할 분리 명확
- `consumeAnswerStream` 내부 try-catch: `donePayload`가 null일 때만 에러 전파 — 정상 완료 후 에러로 처리되는 오탐 방지
- `handleRetryLastAnswer` — `handleSubmitAnswer`와 동일 fetch 로직으로 일관성 유지

---

## 작업 내역

### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/(app)/interview/[sessionId]/page.tsx` | `sessionInterrupted`/`lastSubmittedAnswer` 상태 추가, sessionStorage miss 감지, `consumeAnswerStream` 네트워크 에러 처리, `handleRetryLastAnswer` 구현 |

### 구현 상세
초기화 시 `sessionStorage.getItem()` 결과가 없거나 JSON 파싱 실패 시 `setSessionInterrupted(true)`로 복구 안내 UI를 표시한다. 답변 제출 시 `setLastSubmittedAnswer(submittedAnswer)`로 마지막 답변을 저장하고, SSE 스트림 에러 발생 시 `handleRetryLastAnswer`로 재전송할 수 있다.
