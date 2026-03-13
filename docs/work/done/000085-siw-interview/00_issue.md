# fix: siw interview 서비스 신뢰성 개선 — Zod 검증·테스트 커버리지·E2E CI·엔진 중복호출 방지

## 목적

코드 리뷰(PR #84)에서 발견된 `services/siw` interview 관련 신뢰성 이슈 5개를 일괄 수정한다.

## 배경

PR #84 리뷰에서 IMPORTANT 등급으로 분류된 항목들. 배포 전 반드시 해결 필요.

- **[리뷰 항목 4]** `interview-repository.ts` JSON 컬럼(`history`, `questionsQueue`) 타입 단언만 존재 — 엔진 응답 이상 시 런타임 크래시
- **[리뷰 항목 6]** `playwright.config.ts`에 `webServer` 없음 — E2E CI 자동 실행 불가
- **[리뷰 항목 8]** P2025(세션 없음) 경로 테스트 없음 — `update where: {id}` 실패 → 404 경로 미검증
- **[리뷰 항목 9]** engine 성공 → DB update 실패 시 재시도에서 engine 중복 호출 — 비용 낭비 + 히스토리 오염
- **[리뷰 항목 10]** `interview-service.ts` `resp.json()` 타입 단언 — 런타임 검증 없음

## 완료 기준

- [x] `interview-repository.ts` `findById()`에서 `history`, `questionsQueue` Zod parse 적용
- [x] `interview-service.ts` `start()`, `answer()` engine 응답 Zod parse 적용
- [x] `playwright.config.ts` `webServer` 설정 추가
- [x] `interview-answer-route.test.ts` P2025 → 404 케이스 테스트 추가
- [x] `interview-service.ts` `answer()` engine 응답 캐싱 도입 (`engineResultCache`) + Prisma 마이그레이션

## 구현 플랜

1. Zod 스키마 정의 — `HistoryItemSchema`, `QueueItemSchema`, `EngineStartResponseSchema`, `EngineAnswerResponseSchema`
2. `interview-repository.ts` — Zod parse 적용
3. `interview-service.ts` — engine 응답 Zod parse 적용
4. Prisma 스키마 — `answerDraft String?`, `engineResultCache Json?` 추가 + migration
5. `interview-service.ts` `answer()` — 캐싱 로직 추가
6. `playwright.config.ts` — `webServer` 추가
7. 테스트 추가 — P2025 케이스, 캐싱 동작

## 개발 체크리스트

- [ ] 테스트 코드 포함 (TDD)
- [ ] `services/siw/.ai.md` 최신화
- [ ] 불변식 위반 없음

---

## 작업 내역

### 신규 파일

**`src/lib/interview/schemas.ts`**
- Zod 스키마 전체 정의 (`PersonaTypeSchema`, `QueueItemSchema`, `HistoryItemSchema`, `EngineStartResponseSchema`, `EngineAnswerResponseSchema` 등)
- `types.ts` 수정 없이 독립 파일로 분리 — 기존 타입과 구조 동일해 TypeScript 자동 호환

**`tests/unit/interview-repository.test.ts`**
- repository 단위 테스트 신규 5케이스: findById 정상, currentQuestionType null → "main", 빈 배열, updateAfterAnswer P2025 → session_not_found, updateAfterAnswer 정상

**`prisma/migrations/20260313022544_add_engine_result_cache/migration.sql`**
- `ALTER TABLE interview_sessions ADD COLUMN "engineResultCache" JSONB`
- baseline 마이그레이션(`20260312000000_baseline`) 등록 후 적용 (기존 테이블에 컬럼 추가만)

### 수정 파일

**`src/lib/interview/interview-repository.ts`**
- `findById()`: `as QueueItem[]` 타입 단언 → `QueueItemArraySchema.parse()`, `HistoryItemArraySchema.parse()` 교체. 잘못된 DB 데이터 시 ZodError throw (silent crash 방지)
- `saveEngineResult()` 신규: engine 응답을 `engineResultCache` 컬럼에 write-ahead 저장
- `updateAfterAnswer()`: `engineResultCache` 파라미터 추가 (null 전달 시 `Prisma.DbNull`로 변환, JS null 직접 전달 불가), P2025 catch → `session_not_found` 도메인 에러 변환

**`src/lib/interview/interview-service.ts`**
- `start()`: `await resp.json() as ...` → `EngineStartResponseSchema.parse(await resp.json())`
- `answer()`: `engineResultCache` 확인 → 캐시 HIT 시 engine 재호출 없이 캐시된 결과 사용. engine 성공 직후 `saveEngineResult()` 호출(write-ahead). `updateAfterAnswer()` 시 `engineResultCache: null` 전달해 캐시 클리어

**`src/app/api/interview/answer/route.ts`**
- `session_not_found` → 404 분기 추가 (`findById()`의 P2025는 기존 catch에서, `updateAfterAnswer()`의 P2025는 새 분기에서 처리)

**`playwright.config.ts`**
- `webServer` 추가: CI에서 `npm run dev -p 3001` 자동 실행, `reuseExistingServer: !CI`
- CI 환경 분기: `headless: !!CI`, `retries: CI ? 1 : 0`, `reporter: CI ? "github" : "list"`

**`tests/api/interview-answer-route.test.ts`**
- 4케이스 추가: P2025 → 404, session_not_found → 404, session_complete → 400 메시지 검증, 공백 답변 → 400

**`tests/unit/interview-service.test.ts`**
- 7케이스 추가: engineResultCache 캐시 HIT, engine 3회 실패, 1회 실패 후 재시도 성공, sessionComplete 가드, saveEngineResult 호출 검증, Zod 파싱 실패 (start/answer)

### 기술 결정

| 결정 | 이유 |
|------|------|
| `engineResultCache Json?` (answerDraft 미채택) | JSON native 타입(jsonb), 직렬화 불필요 |
| Zod throw (fallback 없음) | DB 데이터 손상을 조용히 넘기면 근본 원인 추적 불가 |
| P2025 처리 위치: repository | service/route가 Prisma 에러 코드에 의존하면 계층 오염 |
| `Prisma.DbNull` | Prisma JSON nullable 필드에 null 설정 시 JS null 직접 불가 |

