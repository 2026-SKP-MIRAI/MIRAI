# [#258] fix: 연습모드 완료 후 리포트 미생성 + 재답변 중 다음 질문 버튼 비활성화 — 구현 계획

> 작성: 2026-03-26

---

## 배경

연습모드 면접을 완료하면 8축 역량평가 리포트 생성 페이지로 이동했다. 연습모드는 리포트 없이 면접을 마치는 것이 의도된 동작이다. 또한 재답변 제출 중 "다음 질문으로" 버튼이 활성화된 상태로 클릭 가능하여, 피드백 API와 답변 진행 API가 동시에 호출되면서 오류가 발생했다.

## 완료 기준

- [x] 연습모드 `sessionComplete` 시 리포트 없이 "연습 완료" 안내 + 다시하기 버튼만 표시
- [x] 연습모드 중도 종료 시 리포트 이동 없이 `/interview/new`로 이동
- [x] 연습모드 종료 모달에서 리포트 관련 문구 제거
- [x] 재답변 피드백 요청 중 "다음 질문으로" 버튼 비활성화

---

## 구현 계획

### 변경 대상

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/(app)/interview/[sessionId]/page.tsx` | `handleExit` 분기, `sessionComplete` UI 분리, 종료 모달 문구 |
| `services/siw/src/components/InterviewChat.tsx` | `btn-next-question` disabled 조건 추가 |

### 구현 상세

**page.tsx — `handleExit` 변경:**
```ts
// 변경 전
if (history.length >= 5) {
  router.push(`/interview/${sessionId}/report`);
} else {
  router.push("/dashboard");
}

// 변경 후
if (interviewMode === "practice") {
  router.push("/interview/new");
} else if (history.length >= 5) {
  router.push(`/interview/${sessionId}/report`);
} else {
  router.push("/dashboard");
}
```

**page.tsx — `sessionComplete` UI 분리:**
```tsx
// 연습모드: 리포트 없이 종료
{sessionComplete && interviewMode === "practice" && (
  <div ...>
    <h3>연습이 완료됐습니다</h3>
    <button onClick={() => router.push("/interview/new")}>다시 하기</button>
  </div>
)}

// 실전모드: 리포트 이동 유지
{sessionComplete && interviewMode === "real" && (
  <div ...>
    <h3>면접이 완료됐습니다</h3>
    <button onClick={() => router.push(`/interview/${sessionId}/report`)}>리포트 보기</button>
    <button onClick={() => router.push("/interview/new")}>다시 하기</button>
  </div>
)}
```

**page.tsx — 종료 모달 문구 분기:**
```tsx
// 변경 전: 리포트 가능 여부만 표시
// 변경 후: 연습모드에서는 답변 수만 표시
{interviewMode === "practice"
  ? `현재 ${history.length}개의 답변이 있습니다. 종료하시겠습니까?`
  : history.length >= 5
    ? "충분한 답변이 있어 리포트를 생성할 수 있습니다."
    : `아직 답변이 ${history.length}개입니다. 리포트는 5개 이상 답변이 필요합니다.`}
```

**InterviewChat.tsx — 다음 질문 버튼 비활성화:**
```tsx
// 변경 전
disabled={isNextLoading}

// 변경 후
disabled={isNextLoading || isFetchingFeedback}
```

### 테스트 전략
- 기존 `interview-chat.test.tsx` 10개 테스트 통과 확인
- 실전모드 완료 흐름 불변 검증: `sessionComplete && interviewMode === "real"` → 리포트 버튼 존재
- 연습모드 완료 흐름: `sessionComplete && interviewMode === "practice"` → 리포트 버튼 없음
