# [#215] SSE 스트리밍 — 테스트 결과

> 작성: 2026-03-24

---

## Engine pytest (12개)

### `tests/unit/services/test_llm_client_stream.py` (3개)

| 테스트 | 결과 |
|--------|------|
| `test_call_llm_stream_yields_tokens` — mock AsyncOpenAI로 3개 chunk yield 시 정확히 3번 yield | ✅ PASS |
| `test_call_llm_stream_skips_none_content` — delta.content=None chunk는 yield 안 함 | ✅ PASS |
| `test_call_llm_stream_raises_llm_error` — LLM 예외 시 LLMError raise | ✅ PASS |

### `tests/unit/services/test_interview_service_stream.py` (5개)

| 테스트 | 결과 | 비고 |
|--------|------|------|
| `test_stream_path_a_turn_limit` — Path A: 턴 제한 → token 0개 + done(sessionComplete=True) | ✅ PASS | |
| `test_stream_path_a_empty_queue` — Path A: 큐 비어있음 → done(sessionComplete=True) | ✅ PASS | |
| `test_stream_path_b_followup_true` — Path B: shouldFollowUp=True → **token N개** + meta + done(follow_up) | ✅ PASS | Phase 2: Path B도 스트리밍 |
| `test_stream_path_c_next_question` — Path C: shouldFollowUp=False → token N개 + done (JSON 미노출) | ✅ PASS | Phase 2: JSON silent 수집 |
| `test_stream_error_event_on_exception` — 예외 발생 → error 이벤트 yield | ✅ PASS | |

### `tests/integration/test_interview_router_stream.py` (4개)

| 테스트 | 결과 |
|--------|------|
| `test_stream_true_returns_event_stream` — `?stream=true` → Content-Type `text/event-stream` | ✅ PASS |
| `test_stream_false_returns_json` — `?stream=false` → 기존 JSON 응답 동일 | ✅ PASS |
| `test_stream_default_returns_json` — 파라미터 미지정 → 기존 JSON 응답 | ✅ PASS |
| `test_stream_done_event_structure` — done 이벤트 페이로드 구조 검증 | ✅ PASS |

**총합: 12/12 PASS**

---

## siw vitest (13개)

### `src/lib/interview/__tests__/interview-service-stream.test.ts` (7개)

| 테스트 | 결과 |
|--------|------|
| `SSE 연결 성공 시 Response를 반환한다` — fetch 1회 호출, Response 인스턴스 반환 | ✅ PASS |
| `?stream=true 쿼리 파라미터로 엔진을 호출한다` — URL에 `?stream=true` 포함 확인 | ✅ PASS |
| `연결 실패 시 3회 재시도한다` — 2회 reject 후 3회째 성공 | ✅ PASS |
| `3회 모두 실패 시 에러를 던진다` — 3회 reject → throw | ✅ PASS |
| `HTTP 비정상 응답 시 재시도한다` — 500 응답 후 재시도 성공 | ✅ PASS |
| `engineResultCache 존재 시 캐시 데이터를 done 이벤트로 반환한다` — fetch 미호출, done만 반환 | ✅ PASS |
| `session_complete 세션에 에러를 던진다` — sessionComplete=true → throw session_complete | ✅ PASS |

### `src/app/api/interview/answer/__tests__/route.test.ts` (6개)

| 테스트 | 결과 |
|--------|------|
| `SSE 스트림을 클라이언트에 파스스루하고 done 이벤트로 DB를 업데이트한다` — token+done 파스스루, saveEngineResult+updateAfterAnswer 호출 확인 | ✅ PASS |
| `engineResultCache 존재 시 done 이벤트만 반환한다` — token 없고 done만 | ✅ PASS |
| `인증 없이 401을 반환한다` | ✅ PASS |
| `다른 사용자 세션에 403을 반환한다` | ✅ PASS |
| `공백만인 답변에 400을 반환한다` | ✅ PASS |
| `token 이벤트 0개 스트림도 정상 처리된다 (done만)` — Path A/B 시나리오 | ✅ PASS |

**총합: 13/13 PASS**

---

## 버그 수정 내역

### engine pytest — `test_stream_path_b_followup_true` 실패
- **원인**: `questionsQueue`에 `MagicMock` 객체 포함 → `json.dumps()` 직렬화 실패 → `except` 블록에서 `_sse_error` yield → done_events 비어있음
- **수정**: `queue_item = MagicMock(...)` → `queue_item = QueueItem(persona="tech_lead", type="main")` (실제 Pydantic 모델 사용)

### siw vitest — `SSE 연결 성공 시 Response를 반환한다` 실패
- **원인**: mock이 `{ ok: true, body: ReadableStream }` 플레인 객체 반환 → `toBeInstanceOf(Response)` 실패
- **수정**: `mockFetch.mockResolvedValue(new Response(makeSSEStream([...]), { status: 200 }))` 으로 교체

### siw route.ts — 드레인 패턴 버그
- **원인**: `await drainPromise`가 `return new Response(responseStream)` 이전에 위치 → 응답이 drain 완료 후에야 클라이언트에 전달 (스트리밍 효과 없음)
- **수정**: `await drainPromise`를 `responseStream`의 `start()` 콜백 내 `controller.close()` 이후로 이동

---

## siw vitest 추가 (interview-chat streaming unit, 2개)

### `tests/ui/interview-chat.test.tsx` 추가 케이스

| 테스트 | 결과 |
|--------|------|
| `streamingText prop 있을 때 streaming-text 버블 렌더링` | ✅ PASS |
| `streamingText 없을 때 streaming-text 버블 미표시` | ✅ PASS |

### `tests/api/interview-answer-route.test.ts` 업데이트

SSE 전환으로 `interviewService.answer` → `interviewService.answerStream` mock 교체 + 200 케이스 Content-Type 검증으로 변경

| 테스트 | 결과 |
|--------|------|
| `200: text/event-stream 응답` | ✅ PASS |
| `400: sessionId 없을 때` | ✅ PASS |
| `500: service throws 시` | ✅ PASS |
| `404: P2025 에러` | ✅ PASS |
| `404: session_not_found 에러` | ✅ PASS |
| `400: session_complete` | ✅ PASS |
| `400: 공백만인 답변` | ✅ PASS |

---

## siw Playwright e2e (2개)

### `tests/e2e/interview-streaming.spec.ts` (2개)

| 테스트 | 결과 |
|--------|------|
| `실제 엔진 응답이 text/event-stream인지 확인` — /api/interview/answer Content-Type 검증 | ✅ PASS |
| `mock SSE — token 이벤트가 DOM에 렌더링된다 (MutationObserver 감지)` — sawStreaming: true, streamingContent 확인 | ✅ PASS |

**총합: 2/2 PASS**

---

## Phase 2 변경에 따른 기존 테스트 영향

### engine pytest — Path B 테스트 변경

`test_stream_path_b_followup_true` — Phase 2에서 Path B가 token 이벤트를 yield하도록 변경됨:
- **변경 전 기대값**: token 0개 + done
- **변경 후 기대값**: meta 1개 + token N개 + done (follow_up)
- 테스트 어설션 업데이트: `len(token_events) >= 1` + `"더" in reconstructed` ✅

### engine pytest — Path C 테스트 변경

`test_stream_path_c_next_question` — Phase 2에서 JSON silent 수집 패턴으로 변경:
- **검증 추가**: `"{" not in reconstructed` (JSON 원문 미노출 확인) ✅

### siw vitest — InterviewChat.tsx 컴포넌트 테스트

`tests/ui/interview-chat.test.tsx`에 Phase 2 렌더링 순서 검증 포함:

| 테스트 | 결과 |
|--------|------|
| `pendingAnswer prop 있을 때 pending-answer 버블 렌더링` | ✅ PASS |
| `streamingPersona prop 있을 때 해당 페르소나 라벨 표시` | ✅ PASS |
| `isFetchingFeedback=true 시 피드백 생성 중 스피너 렌더링` | ✅ PASS |
| `currentQuestion은 streamingText 있어도 항상 표시` | ✅ PASS |

---

## 전체 결과

| 영역 | 테스트 수 | 결과 |
|------|----------|------|
| engine pytest | 12 | ✅ 12/12 PASS |
| siw vitest | 13 + 9 추가 = 22 | ✅ 22/22 PASS |
| siw playwright e2e | 2 | ✅ 2/2 PASS |
| **합계** | **36** | **✅ 36/36 PASS** |

> siw vitest 전체: 222 passed / 229 (7 pre-existing 실패 — upload-form, resumes/[id] — SSE 무관)

---

## Phase 2 핵심 버그 수정 (테스트로 검증된 것)

| 버그 | 재현 조건 | 수정 방법 | 검증 |
|------|----------|----------|------|
| Path B token 0개 (스트리밍 없음) | shouldFollowUp=True 경로 | meta+token 이벤트 추가 | `test_stream_path_b_followup_true` |
| Path C JSON 원문 노출 | `{"question": "..."}` 그대로 스트리밍 | silent 수집 후 question만 스트리밍 | `test_stream_path_c_next_question` |
| LLM 빈 응답 크래시 | collected_text = "" | `not collected_text.strip()` 가드 추가 | `test_stream_error_event_on_exception` |
| 연습모드 3번 제출 가능 | 2회차 피드백 후 입력창 유지 | retryInputVisible 분리 | 수동 검증 (Playwright) |
