# feat: [seung] SSE 스트리밍 — 면접 답변 LLM 응답 실시간 스트리밍 (체감 속도 개선)

## 사용자 관점 목표
면접 답변 제출 후 다음 질문이 실시간으로 타이핑되듯 나타나, 3~10초 동안 아무것도 안 보이는 대기 시간이 사라진다.

## 배경
siw 서비스에서 #215 이슈로 SSE 스트리밍이 완료됐다. seung도 동일하게 면접 답변 제출 시 LLM 응답을 실시간 스트리밍으로 보여주도록 마이그레이션해야 한다.
현재 seung은 `InterviewChat.tsx` 컴포넌트 내부에 상태 관리 로직이 있고, `/api/interview/answer` route가 엔진에 직접 `fetch()`로 동기 호출 후 JSON 반환하는 구조다.

## 완료 기준
- [x] `src/app/api/interview/answer/route.ts` — 엔진 fetch에 `?stream=true` 추가, SSE 스트림을 클라이언트로 패스스루, `done` 이벤트 수신 시 Supabase DB 업데이트 (기존 rate limiting / auth 로직 유지)
- [x] `src/app/interview/page.tsx` (또는 상위 컴포넌트) — SSE 스트림 파싱 로직 추가, `streamingText` / `streamingPersona` 상태 관리
- [x] `src/components/InterviewChat.tsx` — `streamingText` / `streamingPersona` prop 추가, 스트리밍 중 실시간 텍스트 버블 렌더링
- [x] 테스트: route.ts vitest + InterviewChat 컴포넌트 테스트 (SSE mock 처리)

## 구현 플랜

### 현재 흐름
```
InterviewChat.tsx (내부 state)
  → fetch('/api/interview/answer', { sessionId, answer })
  → route.ts: fetch(ENGINE_URL/api/interview/answer) → resp.json()
  → Supabase DB 업데이트 (rate limiting, auth 포함)
  → return JSON { nextQuestion, sessionComplete }
```

### 변경 후 흐름
```
page.tsx (or 상위)
  → fetch('/api/interview/answer')  ← SSE 스트림 응답
  → route.ts: fetch(ENGINE_URL/api/interview/answer?stream=true) → SSE 패스스루
              done 이벤트 수신 시 Supabase DB 업데이트
  → page.tsx: parseSSEStream() → streamingText 상태 업데이트
  → InterviewChat: streamingText prop → 실시간 버블 렌더링
```

### 단계별 작업

**1단계: `src/app/api/interview/answer/route.ts`**
- 엔진 URL에 `?stream=true` 추가
- 기존 Supabase auth / rate limiting 로직은 **그대로 유지** (앞부분 검증만)
- 엔진 응답 body를 `ReadableStream`으로 클라이언트에 패스스루
- 스트림 중간에 `done` 이벤트 파싱 → DB 업데이트 (drainPromise 패턴 — siw route.ts 참고)
- `Content-Type: text/event-stream` + `Cache-Control: no-cache` 응답

**2단계: `src/app/interview/page.tsx` 또는 answer 호출 컴포넌트**
- `streamingText`, `streamingPersona` 상태 추가
- SSE 스트림 파싱 (`parseSSEStream` 유틸 — siw `sse-utils.ts` 복사 가능)
- token 이벤트: `streamingText += evt.text`
- meta 이벤트: `streamingPersona` 업데이트
- done 이벤트: 기존 `messages` 배열에 새 질문 추가 + streamingText 초기화
- error 이벤트: 에러 상태 처리

**3단계: `src/components/InterviewChat.tsx`**

현재: `messages: Message[]` 배열만 렌더링
변경 후 새 props 추가:
```tsx
streamingText?: string;
streamingPersona?: { persona: string; personaLabel: string } | null;
```

렌더링 추가:
```tsx
{streamingText && (
  <div className={`rounded-xl border p-4 ${colors.bg} ${colors.border}`}>
    <span className={`rounded-full px-2 py-0.5 text-sm font-semibold ${colors.label}`}>
      {streamingPersona?.personaLabel ?? 'AI 면접관'}
    </span>
    <p className="text-gray-900 mt-2">
      {streamingText}<span className="animate-pulse">|</span>
    </p>
  </div>
)}
```

**4단계: 테스트**
- route.ts: SSE 응답 mock, done 이벤트에서 DB 업데이트 확인, auth/rate limit 경로 유지 확인
- InterviewChat: `streamingText` prop 있을 때 버블 렌더링 확인

## 주의사항
- `route.ts`의 Supabase 인증(`createServerClient`) + rate limiting 로직은 스트림 응답으로 변경 후에도 **동일하게 앞부분에서 검증**해야 한다 (인증 실패 시 스트림 시작 전에 401 반환)
- 엔진 timeout: 현재 `ENGINE_FETCH_TIMEOUT_MS = 55_000` — 스트리밍 시 첫 token 도달 기준으로 의미가 달라지므로 timeout 전략 재검토 필요

## 참고
- siw 완성본: `services/siw/src/lib/sse-utils.ts` (parseSSEStream 유틸)
- siw 완성본: `services/siw/src/app/api/interview/answer/route.ts` (drainPromise 패턴)
- siw 완성본: `services/siw/src/components/InterviewChat.tsx`

## 개발 체크리스트
- [x] 테스트 코드 포함
- [x] `services/seung/.ai.md` 최신화
- [x] 불변식 위반 없음 (엔진 직접 호출 금지 — route.ts 경유 유지)


---

## 작업 내역

- `services/seung/src/lib/sse-utils.ts` 신규 생성 — siw와 동일한 `SSEEvent` 타입 + `parseSSEStream` async generator
- `services/seung/src/lib/types.ts` — `InterviewMode = 'real' | 'practice'` 추가
- `services/seung/src/app/api/interview/answer/route.ts` — SSE 패스스루 전환: `?stream=true`, `body.tee()` + drainPromise 패턴, `maxDuration=60`, `X-Accel-Buffering: no`
- `services/seung/src/components/InterviewChat.tsx` — `messages[]` 모델 유지, `streamingText` / `streamingPersona` prop 추가, 스트리밍 버블 렌더링 (`data-testid="streaming-text"`)
- `services/seung/src/app/interview/page.tsx` — `handleRealAnswer` SSE 전환, `streamingText` / `streamingPersona` 상태 추가
- `services/seung/tests/api/interview-answer.test.ts` — SSE mock (`makeSSEStream`) 기반으로 전환, 총 14개 테스트
- `services/seung/tests/components/InterviewChat.test.tsx` — 스트리밍 UI 테스트 5개 추가, 총 22개 테스트
- `services/seung/tests/e2e/interview-flow.spec.ts` — `/api/interview/answer` mock을 SSE 형식으로 전환
- `services/seung/tests/e2e/practice-flow.spec.ts` — `/api/interview/answer` mock을 SSE 형식으로 전환
- `services/seung/.ai.md` 최신화
- 코드 품질 개선 (simplify): drain `doneReceived` 플래그, `resetStreaming()` 헬퍼 추출, scroll rAF 배치, `streamBufRef` 누적 패턴

