# [#170] [seung] 엔진 #113 연동 — targetRole 자동 감지 및 직무 맞춤 질문 생성 — 테스트 결과

> 작성: 2026-03-20

---

## 최종 테스트 결과

### Vitest 단위 테스트

```
Test Files  14 passed (14)
Tests       125 passed (125)
Duration    5.42s
```

**파일별 결과:**

| 파일 | 테스트 수 | 결과 | 비고 |
|------|-----------|------|------|
| `tests/api/questions.test.ts` | 19 | ✅ 전체 통과 | +3 신규 (targetRole 정상/미지정/누락) |
| `tests/api/dashboard.test.ts` | 4 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/resume-delete.test.ts` | 5 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/interview-start.test.ts` | 8 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/interview-answer.test.ts` | 12 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/interview-session.test.ts` | 6 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/report-generate.test.ts` | 11 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/report-get.test.ts` | 5 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/practice-feedback.test.ts` | 12 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/resume-feedback.test.ts` | 13 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/resume-diagnosis.test.ts` | 7 | ✅ 전체 통과 | 변경 없음 |
| `tests/components/InterviewChat.test.tsx` | 11 | ✅ 전체 통과 | 변경 없음 |
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
| `src/lib/engine-client.ts` | `callEngineParse` 삭제, `callEngineAnalyze` 추가 (POST `/api/resume/analyze`, timeout 40s), `callEngineQuestions`에 `targetRole?: string` 파라미터 추가 | ✅ |
| `src/app/api/resume/questions/route.ts` | `callEngineAnalyze` 호출로 교체, `targetRole` 추출 (`"미지정"` 또는 누락 시 `undefined`), `callEngineQuestions(resumeText, targetRole)` 전달, `maxDuration 70 → 80` (analyze 40s + questions 30s 합산 오버헤드 대응) | ✅ |
| `tests/api/questions.test.ts` | `mockCallEngineParse` → `mockCallEngineAnalyze` 전환, 기본 mock에 `targetRole` 추가, `/parse` 테스트명 → `/analyze`, 신규 3개 테스트 추가 | ✅ |
| `services/seung/.ai.md` | `engine-client.ts` 설명 및 진행 상태 최신화 (Phase 5 항목 추가) | ✅ |

---

## TDD 사이클

### RED
- `questions.test.ts` 수정 완료 후 테스트 실행 → **12개 실패**
- 실패 원인: `route.ts`가 여전히 `callEngineParse` 호출 → mock에 해당 export 없어 오류 발생
- 예상한 실패 원인 일치 ✓

### GREEN
- `engine-client.ts`: `callEngineAnalyze` 추가, `callEngineQuestions` 시그니처 변경, `callEngineParse` 제거
- `questions/route.ts`: `callEngineAnalyze` 호출로 교체, `targetRole` 추출·전달 로직 추가
- 재실행 → **19/19 통과**

### 회귀 확인
- 전체 테스트 실행 → **125/125 통과**, 14 파일 전부 이상 없음
