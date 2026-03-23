# [#204] feat: [seung] UX 소개선 — 테스트 결과

> 작성: 2026-03-23

---

## 최종 테스트 결과

### Vitest 단위 테스트

```
Test Files  15 passed (15)
Tests       147 passed (147)
Duration    ~4s
```

**파일별 결과:**

| 파일 | 테스트 수 | 결과 | 비고 |
|------|-----------|------|------|
| `tests/components/InterviewChat.test.tsx` | 17 | ✅ 전체 통과 | +3 신규 (answerCount<5 안내 문구 표시/미표시/sessionComplete=true 미표시) |
| `tests/api/interview-answer.test.ts` | 13 | ✅ 전체 통과 | +1 신규 (TimeoutError → 504) |
| `tests/api/interview-session.test.ts` | 8 | ✅ 전체 통과 | +2 신규 (fileName 포함, fileName=null) |
| `tests/api/questions.test.ts` | 21 | ✅ 전체 통과 | +2 신규 (callEngineAnalyze/callEngineQuestions TimeoutError → 504) |
| `tests/api/report-generate.test.ts` | 12 | ✅ 전체 통과 | +1 신규 (TimeoutError → 504) |
| `tests/api/resume-feedback.test.ts` | 14 | ✅ 전체 통과 | +1 신규 (TimeoutError → 504) |
| `tests/api/interview-start.test.ts` | 8 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/report-get.test.ts` | 5 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/practice-feedback.test.ts` | 12 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/resume-diagnosis.test.ts` | 7 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/resume-delete.test.ts` | 5 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/dashboard.test.ts` | 5 | ✅ 전체 통과 | 변경 없음 |
| `tests/components/AnswerInput.test.tsx` | 8 | ✅ 전체 통과 | 변경 없음 |
| `tests/components/QuestionList.test.tsx` | 5 | ✅ 전체 통과 | 변경 없음 |
| `tests/components/UploadForm.test.tsx` | 7 | ✅ 전체 통과 | 변경 없음 |

---

## 상태 범례

| 아이콘 | 의미 |
|--------|------|
| ⬜ | 미구현 |
| 🔴 | RED — 테스트 작성 완료, 실패 확인 |
| 🟢 | GREEN — 구현 완료, 테스트 통과 |
| ✅ | DONE — 리팩토링 완료 |
| ❌ | FAIL — 테스트 실패 (수정 필요) |

---

## 변경 파일 및 수정 내용

### 수정 파일

| 파일 | 변경 | 결과 |
|------|------|------|
| `src/components/InterviewChat.tsx` | `answerCount < 5 && !sessionComplete`일 때 리포트 안내 문구 추가 | ✅ |
| `src/app/api/interview/answer/route.ts` | 엔진 fetch catch 블록: `TimeoutError` → 504 반환 | ✅ |
| `src/app/api/resume/questions/route.ts` | 엔진 fetch catch 블록 2개: `TimeoutError` → 504 반환 | ✅ |
| `src/app/api/report/generate/route.ts` | 엔진 fetch catch 블록: `TimeoutError` → 504 반환 | ✅ |
| `src/app/api/resume/feedback/route.ts` | 엔진 fetch catch 블록: `TimeoutError` → 504 반환 | ✅ |
| `src/lib/types.ts` | `ERROR_MESSAGES`에 504 추가 | ✅ |
| `src/app/api/interview/session/route.ts` | Prisma resume join + `fileName` 응답 포함 | ✅ |
| `src/app/interview/page.tsx` | `fileName` state 추가, 헤더에 파일명 표시 (null 시 미표시) | ✅ |

---

## TDD 사이클

### RED → GREEN

- 신규 테스트 10개 작성 후 구현 → 147/147 전체 통과
- 회귀 없음 (기존 137개 모두 통과, 신규 10개 추가)

### 주요 디버깅

- `DOMException`은 vitest Node.js 환경에서 `instanceof Error` 체크를 통과하지 못함
  → `(err as { name?: string }).name === 'TimeoutError'` 방식으로 교체하여 해결
