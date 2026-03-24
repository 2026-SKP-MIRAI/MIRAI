# feat: [engine] SSE 스트리밍 — 일반 면접 LLM 응답 실시간 스트리밍 (체감 속도 개선)

## 사용자 관점 목표
면접 답변 제출 후 다음 질문이 타이핑되듯 즉시 나타나, 긴 대기 없이 자연스러운 면접 흐름을 경험할 수 있다.

## 해결하는 문제

현재 `interview/answer` 흐름은 전체가 동기 블로킹이다.

```
클라이언트 → NextJS → Engine(LLM 생성 중...) → NextJS → DB 저장 → 클라이언트
                       ↑ 여기서 3~10초 블로킹. 사용자는 화면만 본다.
```

- `maxDuration = 35s`, `ENGINE_FETCH_TIMEOUT_MS = 55_000`
- LLM이 응답을 **완전히 다 만든 뒤에야** 클라이언트에 전달

**변경 후:**
```
클라이언트 ← token 이벤트 (실시간) ← NextJS ← Engine(LLM 생성 중...)
클라이언트 ← done 이벤트 (완료 시) ← NextJS → DB 저장
```
- 답변 제출 후 ~0.5초 만에 첫 글자 출력
- DB 업데이트는 done 이벤트 수신 후 기존 로직 그대로 실행

---

## ⚠️ 브레이킹 체인지 — 배포 전략 필수

이 이슈는 기존 `/api/interview/answer` 응답 포맷을 **JSON → SSE로 변경**하는 브레이킹 체인지다.

### 해결: `?stream=true` 쿼리 파라미터로 하위 호환성 유지

```
# 기존 방식 그대로 (JSON 응답) — 기본값
POST /api/interview/answer
→ { nextQuestion, updatedQueue, sessionComplete }  ✅ 기존 서비스 무영향

# 스트리밍 방식 (SSE 응답) — 명시적 opt-in
POST /api/interview/answer?stream=true
→ token 이벤트... done 이벤트  ✅ 업데이트한 서비스만 사용
```

---

## 하이브리드 SSE 스펙

### 이벤트 타입 분리

```
# 토큰 이벤트 (LLM 생성 중, 반복)
data: {"type":"token","text":"다음으로 "}\n\n
data: {"type":"token","text":"본인의 "}\n\n
data: {"type":"token","text":"강점을 말씀해주세요."}\n\n

# done 이벤트 (스트리밍 완료 시, 1회)
data: {"type":"done","nextQuestion":{"persona":"competency","personaLabel":"역량","question":"...","type":"followup"},"updatedQueue":[...],"sessionComplete":false}\n\n
```

### 각 레이어 역할

| 레이어 | token 이벤트 | done 이벤트 |
|--------|-------------|------------|
| **Engine** | LLM 토큰 yield | 메타데이터 JSON yield |
| **NextJS** | 클라이언트에 포워딩 | 메타데이터 파싱 → DB 업데이트 → 포워딩 |
| **클라이언트** | 글자 단위 렌더링 | 세션 상태 업데이트, 입력창 활성화 |

---

## 서비스별 변경 분석

### Engine (`engine/`)

**변경 파일**: `app/routers/interview.py`, `app/services/interview_service.py`

```python
# stream=False (기본값) — 기존 JSON 응답 유지
# stream=True — SSE StreamingResponse 반환
@router.post("/answer")
async def answer(req: InterviewAnswerRequest, stream: bool = False):
    if not stream:
        data, usage = process_answer(...)
        return data  # 기존 동작 그대로
    return StreamingResponse(_stream_answer(req), media_type="text/event-stream")
```

---

### siw (`services/siw/`)

**현재 구조**: Zod + 재시도 3회 + caching + observability(이벤트 추적) — 가장 복잡

**변경 파일**: `src/lib/interview/interview-service.ts`

**핵심**: 재시도 기준이 `response.json()` 실패 → 스트림 연결 실패로 재설계 + `tee()` 드레인 패턴으로 disconnect 보호

```typescript
// 변경 후 — 스트림 연결 실패만 재시도
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    const res = await fetch(engineUrl, options)
    if (!res.ok || !res.body) throw new Error('stream init failed')
    return res  // 연결 성공 시 반환, 이후 스트림 파싱은 별도 처리
  } catch { await sleep(1000) }
}
```

`engineResultCache`, `withEventLogging`은 done 이벤트 수신 시점 기준으로 실행 시점 조정.

---

## 완료 기준

**Phase 1: SSE 스트리밍 기반 구현**
- [x] `engine/app/routers/interview.py` — `?stream=true` 쿼리 파라미터 추가, 기본값 false(하위 호환 유지)
- [x] `engine/app/services/interview_service.py` — LLM `stream=True`, token·done 이벤트 yield
- [x] **siw** `interview-service.ts` — 재시도 기준 스트림 연결 실패로 재설계
- [x] **siw** `answer/route.ts` — tee() 드레인 패턴, done 이벤트 DB 업데이트
- [x] **siw** 클라이언트 컴포넌트 — done 세션 상태 업데이트
- [x] 테스트: 엔진 pytest (12개) + siw vitest (13개)

**Phase 2: 스트리밍 UX 개선 + 연습모드 대응**
- [x] 채팅 순서 고정 — 내 답변 즉시 버블 표시 후 그 아래에 다음 질문 스트리밍
- [x] 스트리밍 대기 스피너 — 첫 토큰 전까지 "질문 생성 중..." 애니메이션 표시
- [x] 스트리밍 속도 조정 — 단어 사이 0.07초 딜레이 (자연스러운 타이핑 속도)
- [x] 페르소나 라벨 실시간 전달 — `meta` SSE 이벤트로 스트리밍 시작 전 페르소나 정보 전송
- [x] JSON 노출 버그 수정 — Path C에서 LLM 원본 JSON이 아닌 question 텍스트만 스트리밍
- [x] Path B(꼬리질문) 스트리밍 — 꼬리질문도 단어 단위 스트리밍 적용
- [x] 연습모드 답변 버블 즉시 표시 — 실전모드와 동일한 optimistic display
- [x] 연습모드 "피드백 생성 중..." 스피너 — 실전모드와 동일한 디자인
- [x] 연습모드 재답변 버그 수정 — 2회 제출 후 더 이상 제출 불가 (retryInputVisible 분리)
- [x] "다시 답변하기" UX — 피드백 카드 유지된 채로 재입력 창 아래 표시
- [x] "다음 질문으로" UX — 즉시 피드백 초기화 + 스트리밍 스피너 표시

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `engine/app/routers/interview.py` | `?stream` 파라미터, StreamingResponse 분기 |
| `engine/app/services/interview_service.py` | LLM stream=True, token·done yield, meta 이벤트, Path B 스트리밍, JSON silent 수집 |
| `engine/app/services/llm_client.py` | AsyncOpenAI, call_llm_stream() |
| `services/siw/src/lib/sse-utils.ts` | parseSSELine, parseSSEStream, meta 이벤트 타입 추가 |
| `services/siw/src/lib/interview/interview-service.ts` | answerStream(), 재시도 재설계 |
| `services/siw/src/app/api/interview/answer/route.ts` | tee() 드레인 패턴 |
| `services/siw/src/app/(app)/interview/[sessionId]/page.tsx` | SSE done 이벤트 파싱, pendingAnswer, streamingPersona, retryInputVisible, 연습모드 UX |
| `services/siw/src/components/InterviewChat.tsx` | 채팅 순서 재설계, 스피너, meta 페르소나 라벨, 연습모드 피드백 UX |

## 개발 체크리스트
- [x] 테스트 코드 포함 (vitest + pytest, SSE 스트림 mock)
- [x] 각 서비스 `.ai.md` 최신화
- [x] 불변식 위반 없음 (외부 LLM 호출은 엔진 경유 유지)
- [x] `?stream=true` opt-in으로 서비스별 순차 마이그레이션 가능하게 구현

---

## 작업 내역

### 2026-03-24 — Phase 1: SSE 스트리밍 기반 구현

**현황**: 완료

**완료된 항목**:
- engine/app/services/llm_client.py — AsyncOpenAI lazy init + call_llm_stream() async generator ✅
- engine/app/services/interview_service.py — _sse_token/error/done 헬퍼 + process_answer_stream() Path A/B/C ✅
- engine/app/routers/interview.py — ?stream=true Query 파라미터 + StreamingResponse 분기 ✅
- engine/.ai.md — SSE 엔드포인트 계약 문서화 ✅
- siw src/lib/sse-utils.ts — parseSSELine, parseSSEStream ✅
- siw src/lib/interview/interview-service.ts — answerStream() + engineResultCache 처리 + 재시도 재설계 ✅
- siw src/app/api/interview/answer/route.ts — tee() 드레인 패턴 (await drainPromise → controller.close() 이후로 수정) ✅
- siw src/app/(app)/interview/[sessionId]/page.tsx — parseSSEStream으로 done 이벤트 파싱 ✅
- siw .ai.md — Issue #215 섹션 추가 ✅
- engine pytest 12개 + siw vitest 13개 = 25개 전체 통과 ✅

**변경 파일**: engine 5개 + siw 5개 + docs 3개 = 총 13개

### 2026-03-24 — Phase 2: 스트리밍 UX 개선 + 연습모드 대응

**현황**: 완료

**완료된 항목**:
- `meta` SSE 이벤트 타입 추가 — 스트리밍 전 페르소나 정보 전달 ✅
- Path B(꼬리질문) 단어 단위 스트리밍 + asyncio.sleep(0.07) ✅
- Path C JSON silent 수집 — LLM JSON 원문 대신 question 텍스트만 스트리밍 ✅
- `pendingAnswer` 상태 추가 — 답변 제출 즉시 버블 표시 (optimistic display) ✅
- `streamingPersona` 상태 추가 — meta 이벤트 수신 후 스트리밍 버블 라벨 표시 ✅
- "질문 생성 중..." 스피너 — pendingAnswer 있고 streamingText 없고 isFetchingFeedback 없을 때 표시 ✅
- "피드백 생성 중..." 스피너 — 연습모드 isFetchingFeedback 상태 기반 ✅
- `retryInputVisible` 상태 분리 — isRetried와 독립적으로 입력창 표시 여부 제어 ✅
- 연습모드 재답변 버그 수정 — 2회차 피드백 수신 시 retryInputVisible=false ✅
- "다시 답변하기" — setPracticeFeedback(null) 제거, 피드백 유지하며 retryInputVisible=true만 설정 ✅
- "다음 질문으로" — 함수 시작부에 setPracticeFeedback(null) 즉시 호출로 레이아웃 즉시 초기화 ✅
- handleNextQuestion에 meta 이벤트 처리 및 streamingPersona 상태 연동 ✅
- InterviewChat.tsx 렌더링 순서 재설계 — 히스토리→현재질문→내답변→스피너→스트리밍→완료→연습피드백 ✅
- currentQuestion 항상 표시 (`!streamingText` 조건 제거) ✅

**변경 파일**: engine 1개 + siw 2개 (InterviewChat.tsx, page.tsx) + sse-utils.ts = 총 4개

**테스트 결과**: `docs/work/done/000215-engine-sse-llm/02_test.md` 참조

---

## 설계 근거

### SSE를 기능 06(HeyGen/TTS)보다 먼저 구현한 이유

- **HeyGen은 비동기 API**: 영상 생성에 10~30초 소요. SSE 없이 구현하면 클라이언트 polling이나 블로킹뿐 → SSE 채널이 없으면 기능 06 자체가 성립하지 않음
- **TTS도 동일**: ElevenLabs 응답을 SSE로 청크 스트리밍하면 생성되는 대로 재생 가능. 없으면 전체 완료까지 대기 필수
- **기술 부채 방지**: HeyGen 먼저 붙이면 임시 polling → SSE 전환 시 클라이언트 코드 전면 재작성. SSE 먼저 하면 기능 06은 SSE 이벤트 추가만으로 완성
- **이슈 설계에 명시**: "#215 완료 시 TTS 연동 시 스트리밍 패턴 재활용 가능"으로 의존성 선언됨

### WebSocket이 아닌 SSE를 선택한 이유

- **단방향 통신으로 충분**: 기능 06의 클라이언트→서버 통신은 음성 업로드(HTTP POST) 1회. 연속적 양방향 데이터 교환 없음
- **Next.js/Vercel 호환**: WebSocket은 별도 서버 필요 + Vercel serverless 환경 제약. SSE는 Route Handler에서 기본 지원
- **재연결 자동화**: SSE는 브라우저가 자동 재연결. WebSocket은 끊김 처리 직접 구현 필요
- **결론**: WebSocket은 실시간 채팅·멀티플레이어처럼 클라이언트가 연속 송신할 때 적합. 기능 06은 서버→클라이언트 단방향 push가 전부 → SSE가 최적
