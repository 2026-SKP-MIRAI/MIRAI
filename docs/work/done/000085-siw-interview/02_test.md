# 02_test.md — 테스트 계획 및 실행 가이드

## 테스트 실행 방법

```bash
# 단위/API 테스트 전체 실행
cd services/siw
npx vitest run

# 상세 출력 (케이스별 결과 확인)
npx vitest run --reporter=verbose

# E2E 테스트 (Playwright)
npx playwright test
```

---

## 테스트 파일별 케이스 목록

### tests/api/interview-answer-route.test.ts

| # | 케이스 | 기댓값 |
|---|--------|--------|
| 1 | 200: nextQuestion 반환 | status 200, sessionComplete false |
| 2 | 400: sessionId 없을 때 | status 400 |
| 3 | 500: service throws 시 | status 500 |
| 4 | 404: P2025 에러 (세션 없음) | status 404 |
| 5 | 404: session_not_found 에러 | status 404 |
| 6 | 400: session_complete (이미 완료된 세션) | status 400, message "이미 완료된 면접 세션입니다." |
| 7 | 400: 공백만인 답변 | status 400 |

### tests/unit/interview-service.test.ts

| # | 케이스 | 기댓값 |
|---|--------|--------|
| 1 | start: engine 호출 후 session 생성 | sessionId 반환, firstQuestion.question 일치 |
| 2 | answer: DB에서 context 복원 후 engine에 6필드 전달 | fetch body에 currentQuestion/currentPersona/currentAnswer 포함 |
| 3 | answer: history의 type 필드를 engine에 전달하지 않음 | body.history[0]에 type 없음 |
| 4 | answer: engine 3회 실패 시 engine_answer_failed throw | mockFetch 3회 호출, engine_answer_failed throw |
| 5 | answer: sessionComplete=true 시 engine 호출 없이 session_complete throw | fetch 미호출, session_complete throw |
| 6 | answer: engineResultCache 있으면 engine 재호출 안 함 (캐시 HIT) | fetch 미호출, result.nextQuestion.question = "캐시 질문" |
| 7 | answer: engine 성공 직후 saveEngineResult 호출됨 | saveEngineResult 1회 호출 |
| 8 | answer: engine 응답 Zod 스키마 불일치 시 throw | rejects.toThrow() |
| 9 | start: engine 응답 Zod 스키마 불일치 시 throw | rejects.toThrow() |
| 10 | answer: engine 첫 번째 실패 후 재시도하여 성공 | mockFetch 2회 호출, sessionComplete false |

### tests/unit/interview-repository.test.ts

| # | 케이스 | 기댓값 |
|---|--------|--------|
| 1 | findById: 정상 세션 — questionsQueue/history Zod parse 후 SessionSnapshot 반환 | id/questionsQueue/history/engineResultCache 일치 |
| 2 | findById: currentQuestionType null → 'main' 기본값 처리 | currentQuestionType === "main" |
| 3 | findById: questionsQueue/history 빈 배열 처리 | 두 배열 모두 [] |
| 4 | updateAfterAnswer: P2025 → session_not_found 에러 변환 | rejects.toThrow("session_not_found") |
| 5 | updateAfterAnswer: 정상 업데이트 → void 반환 | resolves.toBeUndefined() |

---

## Mock 전략

### interview-answer-route.test.ts
- `vi.mock("@/lib/interview/interview-service")` — interviewService.answer를 vi.fn()으로 대체
- 각 케이스에서 `mockRejectedValueOnce`로 에러 주입
- `Prisma.PrismaClientKnownRequestError` 직접 생성으로 P2025 시뮬레이션

### interview-service.test.ts
- `vi.mock("@/lib/interview/interview-repository")` — interviewRepository 전체 mock
  - `findById`: 기본값 + `mockResolvedValueOnce`로 케이스별 오버라이드
  - `updateAfterAnswer`, `saveEngineResult`: vi.fn()
- `vi.mock("@/lib/resume-repository")` — resumeRepository.findById mock
- `vi.stubGlobal("fetch", mockFetch)` — 전역 fetch 교체
- `vi.resetModules()` + `vi.clearAllMocks()` 로 테스트 격리

### interview-repository.test.ts
- `vi.mock("@prisma/client")` — PrismaClient 생성자를 mock으로 교체
  - 모듈 레벨 `prisma` 인스턴스가 공유 mock 함수(`mockFindUniqueOrThrow`, `mockUpdate`)를 사용하도록 고정
- `vi.mock("@prisma/adapter-pg")` — PrismaPg 어댑터 mock
- `vi.resetModules()` 로 각 테스트마다 repository 재import → 모듈 캐시 초기화

---

## 커버리지 목표

| 파일 | 목표 |
|------|------|
| src/app/api/interview/answer/route.ts | 100% (분기 전체) |
| src/lib/interview/interview-service.ts | 90%+ (answer/start 핵심 경로) |
| src/lib/interview/interview-repository.ts | 90%+ (findById/updateAfterAnswer/saveEngineResult) |

---

## 주요 검증 포인트

### 1. Engine 응답 Zod 검증
- `EngineStartResponseSchema`, `EngineAnswerResponseSchema`로 engine 응답을 parse
- invalid structure 주입 시 → Zod parse 오류로 throw (500 처리)
- 테스트: `answer: engine 응답 Zod 스키마 불일치 시 throw`, `start: engine 응답 Zod 스키마 불일치 시 throw`

### 2. engineResultCache 캐싱 동작
- `findById` 결과에 `engineResultCache`가 있으면 engine fetch 완전 건너뜀
- 캐시 HIT 시 `saveEngineResult` 미호출
- 테스트: `answer: engineResultCache 있으면 engine 재호출 안 함 (캐시 HIT)`

### 3. P2025 에러 처리
- `updateAfterAnswer` 내부에서 `Prisma.PrismaClientKnownRequestError` P2025 → `session_not_found` 변환
- route에서 `session_not_found` 문자열 에러 → 404 반환
- route에서 P2025가 service 밖으로 전파 시에도 → 404 반환
- 테스트: `updateAfterAnswer: P2025 → session_not_found`, `404: P2025 에러 (세션 없음)`, `404: session_not_found 에러`

### 4. 재시도 로직 (3회)
- engine 응답 실패 시 최대 3회 재시도
- 3회 모두 실패 → `engine_answer_failed` throw
- 테스트: `answer: engine 3회 실패 시 engine_answer_failed throw`
