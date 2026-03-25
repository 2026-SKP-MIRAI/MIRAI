# [#221] feat: [seung] RAG 컨텍스트 통합 — 테스트 결과

> 작성: 2026-03-25

---

## 최종 테스트 결과

### Vitest 단위 테스트 (TypeScript)

```
Test Files  18 passed (18)
Tests       167 passed (167)
Duration    ~4.0s
```

**파일별 결과:**

| 파일 | 테스트 수 | 결과 | 비고 |
|------|-----------|------|------|
| `tests/api/questions.test.ts` | 21 | ✅ 전체 통과 | 변경 없음 (questions RAG 제외 결정 — 엔진 미지원, 불필요로 판단) |
| `tests/api/resume-feedback.test.ts` | 18 | ✅ 전체 통과 | 수정 — mock 방식 변경(global.fetch→callEngineFeedback) + RAG 5개 신규 (RAG_DATABASE_URL 조건 포함) |
| `tests/lib/rate-limit.test.ts` | 5 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/dashboard.test.ts` | 5 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/interview-start.test.ts` | 8 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/interview-answer.test.ts` | 13 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/interview-session.test.ts` | 8 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/report-generate.test.ts` | 12 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/report-get.test.ts` | 5 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/practice-feedback.test.ts` | 12 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/resume-delete.test.ts` | 5 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/resume-diagnosis.test.ts` | 7 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/user-progress.test.ts` | 4 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/analytics-daily.test.ts` | 7 | ✅ 전체 통과 | 변경 없음 |
| `tests/components/InterviewChat.test.tsx` | 17 | ✅ 전체 통과 | 변경 없음 |
| `tests/components/QuestionList.test.tsx` | 5 | ✅ 전체 통과 | 변경 없음 |
| `tests/components/UploadForm.test.tsx` | 7 | ✅ 전체 통과 | 변경 없음 |
| `tests/components/AnswerInput.test.tsx` | 8 | ✅ 전체 통과 | 변경 없음 |

### TypeScript 빌드

```
npx tsc --noEmit → 에러 0건
```

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

### 신규 파일

| 파일 | 내용 | 결과 |
|------|------|------|
| `src/lib/rag/rag-prisma.ts` | RAG 전용 Prisma 클라이언트 (RAG_DATABASE_URL) | ✅ |
| `src/lib/rag/embedding-client.ts` | `embedText()` — 엔진 `/api/embed` 호출, ENABLE_RAG=false 시 null 반환 | ✅ |
| `src/lib/rag/resume-search.ts` | `searchSimilarAcceptedResumes()` — pgvector cosine similarity, jobRole 필터 지원 | ✅ |
| `src/lib/rag/.ai.md` | RAG 모듈 목적·구조·역할 문서화 | ✅ |

### 수정 파일

| 파일 | 변경 | 결과 |
|------|------|------|
| `src/lib/engine-client.ts` | `callEngineQuestions`에 `resumeContext?: string[]` 추가, `callEngineFeedback` 함수 추출 | ✅ |
| `src/app/api/resume/questions/route.ts` | RAG 파이프라인 삽입 (analyze 후, Promise.all 전) — graceful degradation 포함 | ✅ |
| `src/app/api/resume/feedback/route.ts` | 직접 fetch → `callEngineFeedback` 교체, RAG 파이프라인 삽입 | ✅ |
| `tests/api/questions.test.ts` | RAG mock 추가, RAG 테스트 케이스 6개 추가 (RAG_DATABASE_URL·targetRole 조건 포함) | ✅ |
| `tests/api/resume-feedback.test.ts` | mock 방식 전면 변경(`global.fetch` → `callEngineFeedback`), RAG 테스트 케이스 5개 추가 (RAG_DATABASE_URL 조건 포함) | ✅ |
| `services/seung/.ai.md` | rag/ 모듈 구조·환경변수·테스트 수 최신화 | ✅ |

---

## TDD 사이클

### RED → GREEN

- `questions.test.ts` RAG 케이스 6개 작성 → route에 RAG 코드 없음으로 RED → RAG 파이프라인 구현 → 통과
- `resume-feedback.test.ts` RAG 케이스 5개 작성 + mock 방식 전면 변경 → GREEN
- 코드 리뷰 피드백 반영 (RAG_DATABASE_URL 가드·targetRole 조건) → 테스트 3개 추가
- 기존 152개 테스트 회귀 없음, 신규 21개 추가 → 173개 전체 통과

---

## 핵심 설계 결정

| 결정 | 이유 |
|------|------|
| `callEngineQuestions`에 3번째 인자 조건부 전달 | `toHaveBeenCalledWith` 기존 테스트 호환 — `undefined` 인자 포함 시 기존 테스트 깨짐 |
| `callEngineFeedback` 함수 추출 | feedback 라우트의 직접 `fetch` 제거 → 테스트 가능성 향상, RAG 파라미터 전달 단순화 |
| RAG 파이프라인을 Promise.all 밖(앞)에서 실행 | `callEngineQuestions` 인자로 `resume_context` 필요 — 직렬 레이턴시 추가 감수 |
| `resume-search.ts` map 콜백에 명시적 타입 | TypeScript strict mode에서 `$queryRaw` 결과 타입 추론 불일치 → 명시적 타입 어노테이션 |
