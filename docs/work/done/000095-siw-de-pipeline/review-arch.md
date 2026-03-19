# 아키텍처 리뷰 — 이슈 #95

> 검토자: worker-arch | 2026-03-19

---

## 전체 평가

플랜은 전반적으로 정확하고 코드베이스를 잘 반영하고 있다. event-logger 모듈은 이미 구현되어 있으며 플랜과 일치한다. 아래는 Step 3 계측 단계에서 발견된 갭과 개선사항이다.

---

## 발견된 갭

### 갭 1: Site 1 — `start()` 래핑 범위 불명확

- **현황**: 플랜은 "retry loop 전체 래핑"이라고만 기술. `interview-service.ts:15-43`의 `start()` 함수는 retry loop(L20-29) 이후 DB 저장(L34-41)까지 포함.
- **문제/리스크**: "retry loop 전체 래핑"이 retry loop만 감싸는 건지, `start()` 전체를 감싸는 건지 모호. DB 저장까지 래핑하면 DB 에러가 engine 에러로 잘못 기록될 수 있다.
- **권장 수정**: retry loop(L20-30)만 정확히 래핑하도록 명시. 코드:
```ts
// interview-service.ts start() 내부
let resp: Response | null = null;
resp = await withEventLogging('interview_start', null, async () => {
  let r: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    r = await fetch(...);
    if (r.ok) break;
    if (attempt < 2) await new Promise(res => setTimeout(res, 1000));
  }
  if (!r?.ok) throw new Error("engine_start_failed");
  return r;
});
```
`withEventLogging`이 `Response`를 반환하고, 이후 파싱/DB저장은 래핑 밖에서 진행.

---

### 갭 2: Site 2 — `engineResult` 변수 할당 패턴

- **현황**: 플랜은 "cache miss else 블록 내 retry loop 래핑"이라고 기술. 방향은 올바름.
- **문제/리스크**: `engineResult`가 `let`으로 선언되어 있고 `else` 블록 안에서 할당됨(L54-77). `withEventLogging`으로 감싸면 반환값을 `engineResult`에 할당해야 하는데, `withEventLogging`은 `fn()` 반환값을 그대로 돌려주므로 `EngineAnswerResponseSchema.parse()` 호출까지 래핑 안에 넣어야 한다.
- **권장 수정**: retry loop + parse를 함께 래핑:
```ts
} else {
  const historyForEngine = ...;
  engineResult = await withEventLogging('interview_answer', sessionId, async () => {
    let resp: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      resp = await fetch(...);
      if (resp.ok) break;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }
    if (!resp?.ok) throw new Error("engine_answer_failed");
    return EngineAnswerResponseSchema.parse(await resp.json());
  });
  await interviewRepository.saveEngineResult(sessionId, engineResult);
}
```
parse까지 포함하는 게 latency 측정 정확도 면에서도 적절하다 (engine 응답 수신 + 디시리얼라이즈).

---

### 갭 3: Site 5 — `resumes/route.ts` parse의 early return 처리

- **현황**: 플랜은 "단일 fetch 래핑 (try 블록 외부)"라고 기술.
- **문제/리스크**: `resumes/route.ts:35-44`에서 `parseResp.ok`가 false이면 `NextResponse.json()`을 return한다. `withEventLogging`으로 fetch를 감싸면, `!parseResp.ok` 시 throw 대신 early return하는 현재 로직과 충돌한다. `withEventLogging`은 throw가 발생해야 `success=false`를 기록한다.
- **권장 수정**: 래핑 시 `!resp.ok`이면 throw하고, 호출 측에서 catch하여 기존 early return 로직을 유지:
```ts
let parseResult: { resumeText: string };
try {
  parseResult = await withEventLogging('resume_parse', null, async () => {
    const parseResp = await fetch(`${ENGINE_BASE_URL}/api/resume/parse`, {
      method: "POST", body: engineParseForm, signal: AbortSignal.timeout(30000),
    });
    if (!parseResp.ok) {
      const body = await parseResp.json().catch(() => ({ detail: "" }));
      const key = mapDetailToKey(body.detail ?? "", parseResp.status);
      throw Object.assign(new Error(ENGINE_ERROR_MESSAGES[key]), { status: parseResp.status, key });
    }
    return parseResp.json();
  });
} catch (err) {
  if (err instanceof Error && 'status' in err) {
    return NextResponse.json({ message: err.message }, { status: (err as any).status });
  }
  throw err;
}
const { resumeText } = parseResult;
```
또는 더 간단하게: fetch + ok 체크까지만 래핑하고 `!ok`이면 throw, 바깥에서 catch → early return. 어느 쪽이든 플랜에 구체 패턴 명시 필요.

---

### 갭 4: Site 6 — Promise.all 내부 래핑과 병렬성

- **현황**: 플랜은 "Promise.all 내부 fetch 래핑"으로 기술. 방향 정확.
- **문제/리스크**: 병렬성은 유지된다 — `Promise.all([uploadResumePdf(...), withEventLogging(...)])` 형태이므로 두 Promise가 동시 시작. 그러나 플랜에 구체적 코드가 없어 구현자가 실수할 여지가 있다.
- **권장 수정**: Step 3 테이블에 코드 스니펫 추가:
```ts
const [storageKey, engineData] = await Promise.all([
  uploadResumePdf(user.id, buffer, file.name),
  withEventLogging('resume_questions', null, async () => {
    const r = await fetch(`${ENGINE_BASE_URL}/api/resume/questions`, { ... });
    if (!r.ok) { /* 기존 에러 처리 */ throw ...; }
    return r.json();
  }),
]);
```

---

### 갭 5: Site 4 — report/generate의 성공/실패 판단

- **현황**: `report/generate/route.ts:44-51`에서 fetch 후 `engineRes.ok`와 무관하게 `data = await engineRes.json()`을 호출하고, `engineRes.status`를 그대로 응답에 전달.
- **문제/리스크**: `withEventLogging`은 throw 발생 시에만 `success=false`를 기록한다. 그런데 현재 코드는 `!engineRes.ok`여도 throw하지 않고 `Response.json(data, { status: engineRes.status })`로 반환한다. 래핑하면 engine이 500을 반환해도 `success=true`로 기록될 수 있다.
- **권장 수정**: 래핑 내부에서 `!engineRes.ok`이면 throw하도록 변경:
```ts
const { data, status } = await withEventLogging('report_generate', sessionId, async () => {
  const engineRes = await fetch(engineUrl, { ... });
  const d = await engineRes.json();
  if (!engineRes.ok) throw Object.assign(new Error("engine_report_failed"), { data: d, status: engineRes.status });
  return { data: d, status: engineRes.status };
});
```
그리고 catch에서 error 객체의 `data`/`status`를 꺼내 기존 응답 로직 유지. 또는 `withEventLogging`을 사용하지 않고 수동으로 `logLLMEvents`를 호출하는 방식도 가능하나, 일관성 면에서 전자가 낫다.

---

### 갭 6: Site 9 — practice/feedback의 에러 미throw 패턴

- **현황**: `practice/feedback/route.ts:12-17`에서 fetch 후 `engineRes.status === 400` 또는 `!engineRes.ok`이면 throw 없이 `Response.json()`으로 반환.
- **문제/리스크**: 갭 5와 동일. `withEventLogging` 래핑 시 engine 에러가 `success=true`로 기록됨.
- **권장 수정**: Site 4와 동일 패턴 적용. 래핑 내부에서 `!ok`이면 throw, catch에서 기존 에러 응답 복원.

---

### 갭 7: import 문 추가 누락

- **현황**: 플랜 Step 3 테이블에 import 추가에 대한 언급이 없음.
- **문제/리스크**: 5개 파일에 `withEventLogging` import가 필요하나 명시되지 않으면 구현 시 누락 가능.
- **권장 수정**: Step 3에 아래 주의사항 추가:
  - `interview-service.ts`: `import { withEventLogging } from "@/lib/observability/event-logger";`
  - `api/resumes/route.ts`: 동일
  - `api/report/generate/route.ts`: 동일
  - `api/practice/feedback/route.ts`: 동일
  - `api/resume/questions/route.ts`: 동일

---

### 갭 8: Site 3 — followup의 `!resp.ok` throw 후 래핑

- **현황**: `interview-service.ts:110-117`의 followup은 retry loop 없이 단일 fetch. `!resp.ok`이면 throw. 플랜은 "단일 fetch 래핑"으로 기술 — 올바름.
- **문제/리스크**: 없음. `withEventLogging`으로 fetch~throw 구간을 감싸면 성공/실패 모두 정확히 기록. `resp.json()` 반환값이 래핑 결과가 됨.
- **상태**: OK — 추가 수정 불필요.

---

## MIRAI 아키텍처 불변식 준수 확인

| 불변식 | 준수 여부 | 비고 |
|--------|-----------|------|
| 인증은 서비스에서만 | OK | 엔진 수정 없음 |
| 외부 AI API 호출은 엔진에서만 | OK | S3 적재는 AI API가 아님, 인프라 I/O |
| 서비스 간 직접 통신 금지 | OK | observability는 siw 내부 모듈 |
| DB는 서비스가 소유 | OK | Airflow가 별도 analytics DB 사용 (Phase B) |
| 테스트 없는 PR 금지 | OK | Step 2에 8개 TC 명시, 이미 구현됨 |

---

## 플랜 수정 제안

### Step 3 테이블 수정

1. **래핑 방식 컬럼에 구체적 패턴 명시 필요** — 특히 Site 1, 2, 4, 5, 6, 9는 단순 래핑이 아닌 에러 처리 패턴 변환이 필요함. 각 사이트에 대해:
   - throw하지 않는 패턴(early return / status 전달) → throw 패턴으로 변환 후 래핑
   - catch에서 기존 응답 로직 복원

2. **import 문 목록 추가** — Step 3 주의사항에 5개 파일의 import 라인 명시

3. **Site 4, 9 "에러 미throw" 패턴 주의사항 추가** — `withEventLogging`은 throw 기반이므로, `!resp.ok`에서 throw하지 않는 기존 패턴과 충돌. 이를 명시적으로 기술해야 구현자가 success=false 기록 누락을 방지할 수 있음.

4. **Site 5의 early return → try/catch 변환 패턴 구체화** — 현재 "실패 시 re-throw 없이 success=false 기록 후 원래 에러 전파"라는 설명은 `withEventLogging`의 실제 동작(throw 시에만 error 기록)과 모순됨. 정확한 패턴 명시 필요.

### 추가 권장사항

- **Phase A 완료 검증 체크리스트 추가**: 9개 사이트 모두 계측 후 `S3_LOG_BUCKET` 미설정 상태에서 각 API를 한 번씩 호출하여 `logs/llm-events/` 디렉토리에 JSONL이 정상 생성되는지 확인하는 수동 검증 단계 추가.
- **`void logLLMEvents` 패턴**: 현재 `withEventLogging` 내부에서 `void logLLMEvents([...])`로 fire-and-forget 호출. 이는 의도적이며 올바르나, 플랜에 이 동작을 명시하면 구현자의 이해에 도움.
