# [#269] fix: 면접 세션 중단 복구 불가 수정 — sessionStorage 초기화 + 네트워크 끊김 대응 — 구현 계획

> 작성: 2026-03-26

---

## 배경

세 가지 복구 불가 시나리오가 있었다:
1. 브라우저를 닫고 재접속 → sessionStorage 초기화 → 첫 질문 없음 → 빈 화면 또는 초기화 루프
2. SSE 스트림 중 네트워크 끊김(실제 에러) → `consumeAnswerStream` catch 없음 → 사용자가 재시도할 방법 없음
3. SSE 스트림 중 네트워크 끊김(offline silent 종료) → `reader.read()` 가 에러 없이 `done:true` 반환 → catch 미실행 → 에러 메시지 미표시 + `donePayload=null` 로 현재 질문 초기화
4. `fetch` 자체 실패 (`TypeError: Failed to fetch`, offline 상태) → `handleSubmit` catch 없음 → 에러 메시지 미표시

## 완료 기준

- [x] sessionStorage에 첫 질문이 없는 상태로 면접 페이지 접속 시 복구 안내 UI 표시
- [x] SSE 스트리밍 중단(네트워크 오류) 시 에러 메시지와 "마지막 답변 다시 제출" 버튼 표시
- [x] Chrome DevTools offline 모드처럼 스트림이 예외 없이 조기 종료될 때도 에러 메시지 표시
- [x] `fetch` 자체 실패(`TypeError: Failed to fetch`) 시 에러 메시지 표시 및 `pendingAnswer` 복구

---

## 구현 계획

### 변경 대상

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/(app)/interview/[sessionId]/page.tsx` | sessionInterrupted 상태, consumeAnswerStream 에러 처리, handleRetryLastAnswer |

### 구현 상세

**sessionStorage miss 감지:**
```typescript
const stored = sessionStorage.getItem(`interview-first-${sessionId}`);
if (stored) {
  try { setCurrentQuestion(JSON.parse(stored)); }
  catch { setSessionInterrupted(true); } // JSON 파싱 실패
} else {
  setSessionInterrupted(true); // sessionStorage miss
}
```

**consumeAnswerStream 네트워크 에러 처리:**
```typescript
async function consumeAnswerStream(body: ReadableStream) {
  let donePayload = null;
  try {
    for await (const event of parseSSEStream(body)) {
      // ... 기존 로직
    }
  } catch (err) {
    setStreamingText("");
    setStreamingPersona(null);
    if (!donePayload) {
      setError("연결이 끊겼습니다. 마지막 답변을 다시 제출해주세요.");
      throw err;
    }
    // donePayload 있으면 정상 완료로 처리 (에러 무시)
  }
  // offline 모드 등 스트림이 에러 없이 조기 종료된 경우 (done 이벤트 미수신)
  if (!donePayload) {
    setError("연결이 끊겼습니다. 마지막 답변을 다시 제출해주세요.");
    throw new Error("stream terminated without done event");
  }
  return donePayload;
}
```

**handleSubmit catch 추가 (fetch 자체 실패 대응):**
```typescript
} catch (err) {
  setPendingAnswer("");
  // fetch 자체 실패 (offline 등) — consumeAnswerStream은 이미 setError 처리함
  if (err instanceof TypeError) {
    setError("연결이 끊겼습니다. 마지막 답변을 다시 제출해주세요.");
  }
} finally {
  setSubmitting(false);
}
```

**handleRetryLastAnswer:**
```typescript
async function handleRetryLastAnswer() {
  if (!lastSubmittedAnswer.trim() || submitting) return;
  setSubmitting(true);
  setError("");
  setPendingAnswer(lastSubmittedAnswer);
  // ... handleSubmitAnswer와 동일한 fetch 로직
}
```

답변 제출 시 `setLastSubmittedAnswer(submittedAnswer)` 저장.

### 테스트 전략
- sessionStorage miss 시 sessionInterrupted 상태 설정 확인
- SSE 에러 발생 시 에러 메시지 + 재시도 버튼 표시 확인
