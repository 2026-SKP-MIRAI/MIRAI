# [#269] fix: 면접 세션 중단 복구 불가 수정 — sessionStorage 초기화 + 네트워크 끊김 대응 — 구현 계획

> 작성: 2026-03-26

---

## 배경

두 가지 복구 불가 시나리오가 있었다:
1. 브라우저를 닫고 재접속 → sessionStorage 초기화 → 첫 질문 없음 → 빈 화면 또는 초기화 루프
2. SSE 스트림 중 네트워크 끊김 → `consumeAnswerStream` catch 없음 → 사용자가 재시도할 방법 없음

## 완료 기준

- [x] sessionStorage에 첫 질문이 없는 상태로 면접 페이지 접속 시 복구 안내 UI 표시
- [x] SSE 스트리밍 중단(네트워크 오류) 시 에러 메시지와 "마지막 답변 다시 제출" 버튼 표시

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
