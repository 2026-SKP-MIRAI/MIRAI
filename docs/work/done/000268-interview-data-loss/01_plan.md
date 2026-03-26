# [#268] fix: 면접 데이터 무통보 손실 방지 — 답변 초과 경고 + 리포트 저장 실패 처리 — 구현 계획

> 작성: 2026-03-26

---

## 배경

두 가지 데이터 손실 시나리오가 있었다:
1. 면접 답변이 5000자를 초과해도 경고 없이 잘려 저장
2. `saveWithRetry` 재시도 실패 시 에러를 catch만 하고 엔진 리포트를 그냥 반환 → DB에 저장 안 됐지만 사용자는 성공으로 인식

## 완료 기준

- [x] 면접 답변 입력 시 글자 수 카운터 표시, 5000자 초과 시 경고 문구
- [x] saveWithRetry 최종 실패 시 500 응답 반환 및 클라이언트 실패 안내

---

## 구현 계획

### 변경 대상

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/(app)/interview/[sessionId]/page.tsx` | 5000자 카운터 + 경고 UI |
| `services/siw/src/app/api/report/generate/route.ts` | saveWithRetry 실패 시 500 반환 |
| `services/siw/src/app/(app)/interview/[sessionId]/report/page.tsx` | 에러 메시지 텍스트 표시 |
| `services/siw/src/app/api/report/generate/.ai.md` | 동작 변경 기술 |
| `services/siw/tests/api/report-generate-route.test.ts` | 500 반환 테스트 |

### 구현 상세

**답변 카운터 (page.tsx):**
```tsx
<div className="flex items-center justify-between mt-1.5">
  <div>
    {answer.length > 5000 && (
      <p data-testid="char-warning" className="text-xs text-amber-600 font-medium">
        5000자를 초과한 내용은 저장되지 않습니다
      </p>
    )}
  </div>
  <p data-testid="char-count" className={`text-xs ${answer.length > 5000 ? "text-amber-600 font-medium" : "text-gray-400"}`}>
    {answer.length} / 5000
  </p>
</div>
```

**saveWithRetry 실패 처리 (route.ts):**
```typescript
// 기존: 재시도 실패를 console.error만 하고 무시
// 변경
const saveWithRetry = async () => {
  try {
    await interviewRepository.saveReport(...)
  } catch (err) {
    try {
      await interviewRepository.saveReport(...)
    } catch (err2) {
      console.error("[report/generate] saveReport retry failed:", err2);
      throw err2; // 추가: 에러 전파
    }
  }
};
try {
  await saveWithRetry();
} catch {
  return Response.json({ message: "리포트 저장에 실패했습니다. 다시 시도해주세요." }, { status: 500 });
}
```

### 테스트 전략
- 5000자 카운터 + 초과 경고 렌더링 테스트
- saveReport 2회 실패 시 500 반환 테스트
