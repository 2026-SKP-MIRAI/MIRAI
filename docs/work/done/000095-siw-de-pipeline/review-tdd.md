# TDD 리뷰 — 이슈 #95

> 리뷰어: worker-tdd | 날짜: 2026-03-19

---

## 발견된 갭

### 갭 1: `void logLLMEvents` — TC5/TC6 플레이키 테스트 위험

- **현황:** `withEventLogging` (event-logger.ts:58, 67)에서 `void logLLMEvents([...])` 패턴 사용. fire-and-forget으로 로깅 Promise를 await하지 않음.
- **문제:** TC5, TC6에서 `await withEventLogging(...)` 직후 `expect(fs.appendFile).toHaveBeenCalledOnce()` 검증. `void`이므로 `logLLMEvents`의 Promise가 `withEventLogging` 반환 시점에 완료되었다는 보장이 없음.
- **현재 동작하는 이유:** vitest에서 `fs.appendFile`이 `mockResolvedValue(undefined)`로 설정됨 → 동기적으로 resolve되는 microtask. `await withEventLogging(...)` 이후 microtask queue가 flush되면서 `logLLMEvents` 내부의 `await fs.appendFile`도 완료됨. **하지만 이는 구현 세부사항에 의존하는 우연한 통과**임.
- **플레이키 시나리오:**
  1. mock이 `setTimeout` 등 macrotask를 포함하면 즉시 깨짐
  2. `logLLMEvents` 내부 로직이 복잡해져 추가 `await`가 생기면 microtask 체이닝이 달라질 수 있음
  3. S3 경로(bucket 설정 시) 테스트에서는 `getS3Client().send()` → `PutObjectCommand` 체인이 더 깊어 위험 증가
- **권장 수정:**
  - **옵션 A (권장):** `withEventLogging`이 내부적으로 `await logLLMEvents()`를 수행하도록 변경. 로깅이 본 기능을 블로킹하지 않아야 한다면, `try/catch`로 감싸서 로깅 실패가 전파되지 않도록 하되 await는 수행. 이미 `logLLMEvents` 내부에 try/catch가 있으므로 실질적 성능 차이 미미.
  - **옵션 B:** 테스트에서 `await vi.advanceTimersByTimeAsync(0)` 또는 `await new Promise(r => setTimeout(r, 0))` 추가하여 microtask flush 보장. 하지만 이는 구현 세부사항에 테스트를 결합시키는 안티패턴.
  - **플랜 반영:** Step 1 구현에서 `void logLLMEvents` → `await logLLMEvents`로 변경 명시 필요.

---

### 갭 2: Step 3 (API routes 계측) 테스트 스펙 부재

- **현황:** 플랜 Step 2에는 event-logger 모듈 자체의 단위 테스트 8개만 존재. Step 3에서 9개 call site에 `withEventLogging` 래핑을 추가하는데, 이 래핑이 올바른지 검증하는 테스트가 전혀 없음.
- **문제:**
  1. 래핑 후 기존 기능(fetch → response 파싱 → 반환)이 정상 동작하는지 검증 없음
  2. 잘못된 `feature_type` 매핑, `session_id` 누락, 래핑 범위 오류를 잡을 수 없음
  3. retry loop 래핑(사이트 1, 2)에서 retry 내부 vs 외부 래핑 차이를 검증할 수 없음
  4. Promise.all 내부 래핑(사이트 6)에서 병렬성 보존 검증 없음
- **권장 수정:** 최소한 다음 수준의 테스트 추가를 플랜에 명시:

  **A. 스모크 테스트 (필수, 최소 3개):**

  | # | 테스트 케이스 | 검증 내용 |
  |---|---|---|
  | ST-1 | interview-service 래핑 후 정상 응답 보존 | `startInterview()` 호출 → engine mock 응답 → 원본 반환값 그대로 반환 + `logLLMEvents` 호출됨 |
  | ST-2 | interview-service 래핑 후 에러 전파 보존 | engine 에러 → 원본 에러 re-throw + `logLLMEvents`에 success=false 기록 |
  | ST-3 | resumes/route.ts Promise.all 병렬성 보존 | parse + questions 동시 호출 → 두 개 모두 `withEventLogging` 경유 + 총 latency가 직렬 합산보다 작음 |

  **B. feature_type 매핑 검증 (권장):**

  | # | 테스트 케이스 | 검증 내용 |
  |---|---|---|
  | FT-1 | 각 call site의 feature_type이 플랜 테이블과 일치 | 9개 사이트 각각에서 `logLLMEvents`에 전달된 event의 `feature_type` 검증 |

  **테스트 레벨:** `withEventLogging`을 spy하고 실제 API route handler를 호출하는 통합 테스트. engine은 HTTP mock (msw 또는 vi.mock fetch).

---

### 갭 3: 모듈 레벨 S3Client singleton — 테스트 격리 문제

- **현황:** `event-logger.ts:16`에 `let s3Client: S3Client | null = null` 모듈 레벨 singleton. `getS3Client()`가 첫 호출 시 생성하고 이후 재사용.
- **문제:** 테스트에서 `await import("@/lib/observability/event-logger")`로 동적 import 사용. 하지만 `vi.mock("@aws-sdk/client-s3")`가 top-level에서 호출되어 모든 import에 동일한 mock 모듈 반환. ESM 모듈 캐시가 vitest에서 어떻게 동작하는지에 따라:
  1. TC1 (S3 bucket 설정)에서 singleton이 생성됨
  2. TC2 (로컬 fallback)에서 bucket 미설정이지만, 모듈이 캐시되어 있으면 이전 singleton이 남아있을 수 있음
  3. TC8 (S3 key 패턴)에서 TC1의 singleton이 재사용되면 `S3Client` mock의 `mockReturnValue`가 적용 안될 수 있음
- **현재 동작하는 이유:** vitest는 `vi.mock`으로 hoisted된 모듈에 대해 각 `await import()`가 fresh evaluation을 수행하는 것으로 보임 (vitest의 module transformation). 하지만 이는 vitest 내부 동작에 의존.
- **권장 수정:**
  - 각 테스트의 `beforeEach`에 `vi.resetModules()` 추가. 현재는 `vi.clearAllMocks()`만 있어 mock 호출 기록은 초기화되지만 모듈 캐시는 남음.
  - 또는 `event-logger.ts`에 테스트용 `resetS3Client()` 내보내기 (비권장 — 테스트를 위한 프로덕션 코드 변경).
  - **플랜 반영:** `beforeEach`에 `vi.resetModules()` 추가를 명시.

---

### 갭 4: TDD 사이클 — Step 3에 Red-Green-Refactor 미적용

- **현황:** Step 1(구현) → Step 2(테스트) 순서로 이미 완료. TDD 원칙(Test First)과 반대.
- **문제:** Step 1, 2는 이미 완료되어 소급 불가. 하지만 Step 3 (9개 call site 계측)은 아직 미착수이므로 TDD 적용 가능하고 적용해야 함.
- **권장 수정:** Step 3을 다음과 같이 TDD 사이클로 재구성:
  1. **Red:** 래핑 대상 call site에 대한 스모크 테스트 작성 (갭 2의 ST-1, ST-2, ST-3). `withEventLogging` 호출 여부를 spy로 검증 → 실패 (아직 래핑 안됨)
  2. **Green:** 9개 call site에 `withEventLogging` 래핑 적용 → 테스트 통과
  3. **Refactor:** 중복 패턴 정리 (필요 시)

---

## 플랜 수정 제안

### Step 1 수정: `void logLLMEvents` → `await logLLMEvents`

현재:
```ts
void logLLMEvents([{...}]);
return result;
```

수정:
```ts
await logLLMEvents([{...}]);
return result;
```

근거: `logLLMEvents`는 내부에서 이미 try/catch로 모든 에러를 삼키므로, await해도 본 기능 흐름에 영향 없음. 테스트 안정성과 디버깅 용이성(unhandled rejection 방지) 모두 개선됨. fire-and-forget이 필요한 성능 요구사항이 현재 없음 (engine 호출 latency >> 로깅 latency).

---

### Step 2 수정: `beforeEach`에 `vi.resetModules()` 추가

```ts
beforeEach(() => {
  vi.resetModules();  // ← 추가
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
```

근거: S3Client singleton이 테스트간 공유되는 것을 방지. 각 테스트가 독립적인 모듈 상태에서 실행되도록 보장.

---

### Step 3 수정: TDD 사이클 + 테스트 스펙 추가

현재 Step 3은 래핑 작업만 기술. 다음으로 확장:

**Step 3-A: 테스트 작성 (Red)**

파일: `services/siw/tests/unit/api-instrumentation.test.ts` (또는 기존 테스트 파일에 describe 블록 추가)

| # | 테스트 케이스 | 검증 내용 |
|---|---|---|
| ST-1 | interview start 래핑 — 정상 응답 보존 | `startInterview()` → engine mock 응답 반환 + `withEventLogging` spy 호출 with feature_type="interview_start" |
| ST-2 | interview start 래핑 — 에러 전파 보존 | engine 에러 → 원본 에러 re-throw + spy에 success=false |
| ST-3 | resumes route — Promise.all 병렬성 보존 | parse + questions 동시 → 둘 다 `withEventLogging` 경유 |
| ST-4 | 각 call site feature_type 매핑 정확성 | 9개 사이트 → 올바른 feature_type 전달 확인 (가능한 범위에서) |

**Step 3-B: 래핑 적용 (Green)**

(기존 Step 3 내용 그대로)

**Step 3-C: 검증 (Refactor)**

- 전체 테스트 실행 (`npx vitest run`)
- 기존 테스트 회귀 없음 확인

---

## 요약: 우선순위별 조치 사항

| 우선순위 | 항목 | 영향 |
|---------|------|------|
| **P0 (필수)** | `void logLLMEvents` → `await logLLMEvents` | 플레이키 테스트 방지, unhandled rejection 방지 |
| **P0 (필수)** | Step 3 테스트 스펙 추가 | 래핑 정확성 검증 수단 확보 |
| **P1 (권장)** | `vi.resetModules()` 추가 | 테스트 격리 강화 |
| **P1 (권장)** | Step 3 TDD 사이클 재구성 | Red-Green-Refactor 적용 |
