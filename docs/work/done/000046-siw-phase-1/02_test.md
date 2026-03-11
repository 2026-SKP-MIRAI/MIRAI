# [#46] feat: [siw] Phase 1 — 패널 면접 + 꼬리질문 서비스 연동 — 테스트

> 작성: 2026-03-10

---

## 최종 결과

```
npm test (vitest)
30 passed (8 test files) in 2.3s

npm run test:e2e (playwright)
2 passed (2 tests) in 35.9s
```

유닛/API/UI 30개 + e2e 2개 전부 통과. 리그레션(기존 테스트) 포함.

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

## 테스트 파일 구조

```
services/siw/tests/
├── unit/
│   └── interview-service.test.ts     ← 신규 (2개)
├── api/
│   ├── error-messages.test.ts        ← 기존 (7개)
│   ├── resume-questions-route.test.ts← 기존 수정 (6개)
│   ├── interview-start-route.test.ts ← 신규 (3개)
│   └── interview-answer-route.test.ts← 신규 (3개)
└── ui/
    ├── interview-chat.test.tsx        ← 신규 (2개)
    ├── question-results.test.tsx      ← 기존 수정 (2개)
    └── upload-form.test.tsx           ← 기존 (5개)
```

---

## 사이클 1 — 타입 컴파일 검증

```bash
npx tsc --noEmit   # 오류 0 확인
```

| # | 검증 항목 | 상태 |
|---|----------|------|
| 1 | `PersonaType`, `QueueItem`, `QuestionWithPersona`, `HistoryItem`, `InterviewAnswerResponse` 타입 추가 | ✅ |
| 2 | `QuestionsResponse.resumeText` 필드 추가 | ✅ |
| 3 | `ENGINE_ERROR_MESSAGES` 에 `interviewStartFailed`, `interviewAnswerFailed`, `sessionNotFound` 추가 | ✅ |

---

## 사이클 2 — DDD 레이어별 유닛 테스트

### `tests/unit/interview-service.test.ts`

파일: `services/siw/tests/unit/interview-service.test.ts`

mock 패치: `@/lib/interview/interview-repository` + `global.fetch`

| # | 테스트명 | 상태 | 비고 |
|---|----------|------|------|
| 1 | `start: engine 호출 후 session 생성` | ✅ | `sessionId === "mock-session-id"`, `firstQuestion.question === "자기소개"` |
| 2 | `answer: DB에서 context 복원 후 engine에 6필드 전달` | ✅ | `currentQuestion`, `currentPersona` DB 복원 확인, `currentAnswer` 클라이언트 입력 확인 |

**핵심 검증 — answer의 6필드 복원:**
```typescript
expect(body.currentQuestion).toBe("자기소개를 해주세요."); // DB 복원
expect(body.currentPersona).toBe("hr");                   // DB 복원
expect(body.currentAnswer).toBe("내 답변");               // 클라이언트 입력
```

---

### `tests/api/interview-start-route.test.ts`

파일: `services/siw/tests/api/interview-start-route.test.ts`

mock 패치: `@/lib/interview/interview-service`

**`POST /api/interview/start`**

| # | 테스트명 | 상태 | 비고 |
|---|----------|------|------|
| 3 | `200: sessionId와 firstQuestion 반환` | ✅ | `res.status === 200`, `data.sessionId === "test-session"` |
| 4 | `400: resumeText 없을 때` | ✅ | `res.status === 400` |
| 5 | `500: service throws 시` | ✅ | `mockRejectedValueOnce` → `res.status === 500` |

---

### `tests/api/interview-answer-route.test.ts`

파일: `services/siw/tests/api/interview-answer-route.test.ts`

mock 패치: `@/lib/interview/interview-service`

**`POST /api/interview/answer`**

| # | 테스트명 | 상태 | 비고 |
|---|----------|------|------|
| 6 | `200: nextQuestion 반환` | ✅ | `res.status === 200`, `data.sessionComplete === false` |
| 7 | `400: sessionId 없을 때` | ✅ | `res.status === 400` |
| 8 | `500: service throws 시` | ✅ | `mockRejectedValueOnce` → `res.status === 500` |

---

### `tests/ui/interview-chat.test.tsx`

파일: `services/siw/tests/ui/interview-chat.test.tsx`

mock 패치: 없음 (순수 렌더링 테스트)

| # | 테스트명 | 상태 | 비고 |
|---|----------|------|------|
| 9 | `페르소나 레이블과 질문 버블 렌더링` | ✅ | `data-testid="chat-message"` 1개, `persona-label` → "HR 담당자" |
| 10 | `sessionComplete=true 시 완료 메시지` | ✅ | `data-testid="session-complete"` 존재 |

---

## 기존 테스트 리그레션 확인

| 파일 | 테스트 수 | 수정 내용 | 상태 |
|------|-----------|----------|------|
| `tests/api/error-messages.test.ts` | 7 | — | ✅ |
| `tests/api/resume-questions-route.test.ts` | 6 | `vi.mock("pdf-parse")` 추가 (pdf-parse 도입으로 mock 필요) | ✅ |
| `tests/ui/question-results.test.tsx` | 2 | `vi.mock("next/navigation")` + `mockData.resumeText` 추가 (QuestionList에 useRouter 추가됨) | ✅ |
| `tests/ui/upload-form.test.tsx` | 5 | — | ✅ |
| `tests/unit/interview-service.test.ts` | **2** | 신규 | ✅ |
| `tests/api/interview-start-route.test.ts` | **3** | 신규 | ✅ |
| `tests/api/interview-answer-route.test.ts` | **3** | 신규 | ✅ |
| `tests/ui/interview-chat.test.tsx` | **2** | 신규 | ✅ |
| **합계** | **30** | | ✅ |

---

## 커버리지 정성 평가

| 케이스 | 테스트 여부 |
|--------|------------|
| 면접 시작 정상 응답 (200) | ✅ start route |
| 면접 답변 정상 응답 (200) | ✅ answer route |
| 필수 필드 누락 (400) | ✅ start, answer 각각 |
| service 오류 (500) | ✅ start, answer 각각 |
| answer — DB에서 6필드 복원 | ✅ service unit 핵심 검증 |
| 페르소나 레이블 렌더링 | ✅ InterviewChat UI |
| 세션 완료 메시지 렌더링 | ✅ InterviewChat UI |
| pdf-parse resumeText 추출 | ✅ resume-questions-route mock 검증 |
| QuestionsResponse.resumeText 타입 | ✅ question-results 리그레션 |

---

## 구현 중 발견된 이슈 및 해결

| # | 발견 시점 | 이슈 | 해결 방법 |
|---|-----------|------|-----------|
| 1 | vitest 실행 | `vi.mock("pdf-parse")` 무효 → resume route 500 | `pdf-parser.ts` 추상화 후 `vi.mock("@/lib/pdf-parser")` |
| 2 | e2e 실행 | pdf-parse v2 API — `PDFParse` 클래스로 변경됨 | `new PDFParse({ data: buf }).getText()` |
| 3 | e2e 실행 | webpack 번들링으로 pdf-parse 런타임 오류 | `next.config.ts: serverExternalPackages: ["pdf-parse"]` |
| 4 | e2e 실행 | `new PrismaClient()` 단독 → `PrismaClientInitializationError` | Prisma v7 요구사항: `@prisma/adapter-pg` 필수 |
| 5 | e2e 실행 | `prisma.config.ts` — `env()` 환경변수 로드 실패 | `import "dotenv/config"` + `process.env` 직접 참조 |
| 6 | e2e 실행 | 엔진 `/api/interview/start` 간헐적 500 (LLM JSON 잘림) | `interview-service.ts` 3회 재시도 로직 |
| 7 | e2e 실행 | Playwright strict mode — `locator.or()` 복수 요소 | `.first()` 추가 |

---

## 사이클 3 — Playwright e2e

파일: `tests/e2e/interview-session.spec.ts`

```bash
# 조건: engine(8000) + siw(3001) 모두 기동
npm run test:e2e
# 결과: 2 passed (35.9s)
```

| # | 테스트명 | 상태 | 비고 |
|---|----------|------|------|
| 1 | `업로드 → 질문 생성 → 면접 시작 → 답변 → 완료` | ✅ | 실제 PDF + 엔진 LLM 호출 포함 |
| 2 | `완료 후 '다시 하기' → /resume 복귀` | ✅ | `/resume` 페이지 정상 렌더링 확인 |

**해결한 주요 이슈:**
- `pdf-parse v2` API 변경 (`PDFParse` 클래스) → `src/lib/pdf-parser.ts` 추상화
- Prisma v7 드라이버 어댑터 필수 → `@prisma/adapter-pg` 도입
- 엔진 LLM JSON 파싱 간헐적 실패 → `interview-service.ts`에 3회 재시도 로직 추가
- `serverExternalPackages: ["pdf-parse"]` — webpack 번들링 제외

timeout: `180_000` (LLM 체인 대비)
