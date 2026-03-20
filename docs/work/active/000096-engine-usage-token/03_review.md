# #96 Engine Usage Token — Code Review

> 리뷰어: worker-2 (code-reviewer)
> 브랜치: `refactor/000096-engine-usage-token` vs `main`
> 날짜: 2026-03-20

---

## 1. 변경 요약

37개 파일, +817 / -131 lines. 주요 변경:

| 영역 | 파일 수 | 내용 |
|------|---------|------|
| Engine core | 7 | `LLMResult` dataclass 도입, `UsageMetadata` Pydantic 모델, 모든 서비스 함수에서 `(result, usage)` 튜플 반환 |
| Engine routers | 4 | 모든 라우터에서 `data.usage = usage` 패턴으로 응답에 usage 주입 |
| Engine tests | 12 | unit + integration 테스트에 usage 검증 추가 |
| SIW event-logger | 1 | `EngineUsage` 인터페이스, `LLMEventMeta.usage` 필드, `withEventLogging`에서 usage 로깅 |
| SIW routes | 5 | `if (d.usage) meta.usage = d.usage;` 패턴으로 engine 응답 → 이벤트 로그 연결 |
| SIW tests | 1 | TC13: usage 필드 로그 검증 |
| Airflow DAG | 1 | `aggregate_metrics`에 token 집계 + 비용 추정 추가 |
| Airflow migration | 1 | `total_tokens`, `estimated_cost_usd` 컬럼 추가 SQL |
| engine/.ai.md | 1 | Usage 메타데이터 섹션 추가 |
| docs/ | 2 | 00_issue.md, 01_plan.md |

---

## 2. 검토 기준별 평가

### 2.1 usage None 케이스 안전 처리 -- PASS

**Engine 측:**
- `llm_client.py:54-59`: `raw_usage = response.usage` 후 `if raw_usage else None`으로 안전 처리
- 모든 서비스(`llm_service.py`, `interview_service.py`, `feedback_service.py`, `practice_service.py`, `report_service.py`)에서 `_usage_to_metadata()` 헬퍼가 `usage is None`일 때 `None` 반환
- `interview_service.py:113`: `process_answer`에서 턴 제한/큐 비어있을 때 LLM 호출 없이 `None` 반환 -- 정상
- `role_service.py`: usage를 반환하지 않음 (targetRole은 내부 보조 함수이므로 적절)

**SIW 측:**
- 모든 route에서 `if (d.usage) meta.usage = d.usage;` -- usage 없으면 할당하지 않음, safe
- `event-logger.ts:107-109`: `meta.usage?.prompt_tokens` optional chaining으로 undefined 전파 -- safe

**테스트:**
- `test_llm_client.py:64-75`: `usage=None` 반환 케이스 테스트 존재
- `test_interview_service.py:118`: 턴 제한 시 `usage=None` 반환 검증

### 2.2 기존 route 호출부 backward compatibility -- PASS

**Engine 응답 스키마:**
- 모든 응답 모델에서 `usage: UsageMetadata | None = None` -- Optional with default None
- 기존 클라이언트가 `usage` 필드를 무시해도 문제 없음 (additive change)
- `QuestionsResponse`, `InterviewStartResponse`, `InterviewAnswerResponse`, `FollowupResponse`, `ReportResponse`, `PracticeFeedbackResponse`, `ResumeFeedbackResponse` 모두 동일 패턴

**SIW 측:**
- `if (d.usage)` guard로 engine이 usage를 반환하지 않는 구버전에서도 동작
- `EngineUsage` 인터페이스의 모든 필드가 optional (`prompt_tokens?`, `completion_tokens?`, `model?`)

### 2.3 타입 일관성 (Python <-> TypeScript) -- PASS (경미한 관찰 1건)

**Python 측 (`UsageMetadata`):**
```
prompt_tokens: int
completion_tokens: int
total_tokens: int
model: str
```

**TypeScript 측 (`EngineUsage`):**
```
prompt_tokens?: number
completion_tokens?: number
model?: string
```

- `total_tokens`가 TypeScript 측에 없음 -- 이는 의도적 설계로 판단됨. SIW는 `prompt_tokens`와 `completion_tokens`만 개별 로깅하고, `total_tokens`는 Airflow DAG에서 합산하여 계산 (`sum_prompt_tokens + sum_completion_tokens`). 중복 전달 불필요.
- TypeScript 측 모든 필드가 optional인 것은 engine 구버전 하위호환을 위한 defensive design으로 적절.

### 2.4 테스트 커버리지 -- PASS

**Engine unit tests (7개 서비스):**

| 테스트 파일 | usage 관련 검증 |
|------------|----------------|
| `test_llm_client.py` | usage 반환 (TC), usage=None 케이스 (TC), content=None LLMError (TC) |
| `test_llm_service.py` | `generate_questions` 튜플 반환 및 usage mock |
| `test_interview_service.py` | `start_interview` usage mock, `process_answer` 턴 제한 시 None |
| `test_feedback_service.py` | `generate_resume_feedback` 튜플 반환 |
| `test_practice_service.py` | `generate_practice_feedback` usage mock |
| `test_report_service.py` | `generate_report` usage mock |
| `test_role_service.py` | usage 미반환 (역할 추출 전용) |

**Engine integration tests (5개 라우터):**

| 테스트 파일 | usage 검증 |
|------------|-----------|
| `test_interview_router.py` | `assert "usage" in data` |
| `test_practice_router.py` | `assert "usage" in data` |
| `test_report_router.py` | `assert "usage" in data` |
| `test_resume_questions_route.py` | `assert "usage" in data` |
| `test_resume_feedback_router.py` | `assert "usage" in data` |

**SIW tests:**
- `event-logger.test.ts` TC13: `withEventLogging`에서 `meta.usage` 설정 시 `prompt_tokens`, `completion_tokens`, `model` 로그 포함 검증

### 2.5 engine/.ai.md 최신화 여부 -- PASS

- `engine/.ai.md:88-121`: "응답 스키마 및 Usage 메타데이터 (#96)" 섹션 추가
  - `LLMResult` dataclass, `UsageMetadata` Pydantic model 문서화
  - 사용 패턴 (서비스 튜플 반환, 라우터 주입, event-logger 연동) 기술
  - None safety 주의사항 명시

---

## 3. 아키텍처 불변식 검증

| 불변식 | 준수 여부 |
|--------|----------|
| 1. 인증은 서비스에서만 -- 엔진 인증 없음 | PASS -- engine에 auth 로직 없음 |
| 2. 외부 AI API 호출은 엔진에서만 | PASS -- SIW는 engine fetch만 수행 |
| 3. 서비스 간 직접 통신 금지 | PASS -- SIW -> engine 단방향만 존재 |
| 4. DB는 서비스가 소유 -- 엔진 stateless | PASS -- engine에 DB 접근 없음 |
| 5. 테스트 없는 PR 머지 금지 | PASS -- 12개 engine 테스트 + 1개 SIW 테스트 |

---

## 4. 발견 사항

### 4.1 관찰 (Non-blocking)

1. **`resumes/route.ts:82-90` feedback fetch에 `withEventLogging` 미적용**: `Promise.all` 내 세 번째 항목인 `/api/resume/feedback` fetch는 `withEventLogging`으로 감싸지 않음. best-effort (`.catch(() => null)`) 특성상 로깅 누락은 기능에 영향 없으나, feedback 호출의 latency/error가 이벤트 로그에 기록되지 않음. 향후 observability 확장 시 고려.

2. **`_usage_to_metadata` 헬퍼 중복**: `llm_service.py`, `interview_service.py`, `feedback_service.py`, `practice_service.py`, `report_service.py` 5개 파일에 동일한 `_usage_to_metadata` 함수가 반복 정의됨. 현재 scope에서는 문제 아니나, 향후 공통 유틸로 추출 가능.

3. **Airflow DAG 비용 추정 모델 하드코딩**: `llm_quality_dag.py:62-64`에서 `(prompt/1000)*0.00015 + (completion/1000)*0.0006` 고정값 사용. `event-logger.ts`의 `estimateCostUsd`도 동일한 단가 사용. 모델별 단가가 변경되면 두 곳 모두 수정 필요 -- 단, 현재 `google/gemini-2.5-flash` 단일 모델이므로 수용 가능.

4. **`resumes/route.ts` feedback fetch에서 usage 미수집**: 82-90행의 feedback fetch 응답에서 `d.usage`를 event log에 연결하지 않음. 이는 해당 fetch가 `withEventLogging` 밖에 있기 때문이며, 4.1.1과 동일 맥락.

### 4.2 확인 완료 (No issues)

- Engine `schemas.py`의 모든 Response 모델에 `usage: UsageMetadata | None = None` 일관 적용
- `LLMResult` dataclass의 `usage: UsageInfo | None` 타입이 OpenAI SDK의 `response.usage` nullable과 정확히 매핑
- `interview_service.py` `process_answer`에서 LLM 미호출 경로 (턴 제한/큐 소진)에서 `None` 반환 -- 정상
- Airflow migration SQL의 `IF NOT EXISTS` 절로 idempotent 적용 보장
- `withEventLogging` 실패 경로에서 usage 미기록 (112-123행) -- 실패 시 usage 없는 것이 자연스러움

---

## 5. 결론

**APPROVE** -- 전체 변경이 설계 의도에 부합하며, 안전성/하위호환성/테스트 커버리지 기준을 충족함.

- usage None 케이스: 모든 경로에서 안전 처리 확인
- backward compatibility: Optional 필드 + guard 조건으로 기존 호출부 영향 없음
- 타입 일관성: Python/TypeScript 간 의도적 차이 (total_tokens 생략) 외 일관
- 테스트: engine 12개 + SIW 1개, 모든 라우터 integration 테스트에서 usage 존재 검증
- engine/.ai.md: 최신화 완료
