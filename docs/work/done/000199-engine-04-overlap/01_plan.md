# [#199] feat: [engine] 기능04 꼬리질문 품질 검증 — overlap 기반 재생성 — 구현 계획

> 작성: 2026-03-24 | 수정: 2026-03-24 (Architect + Critic 피드백 반영 v2)

---

## 완료 기준

- [ ] 생성된 꼬리질문과 답변 약점 부분의 semantic overlap < OVERLAP_THRESHOLD(0.5) 시 자동 재생성
- [ ] 재생성 최대 2회 제한 — 초과 시 마지막 생성본 반환 (무한루프 방지)
- [ ] 재생성 미발생 시 latency 증가 1초 이내 (embedding 1회 추가 ~200ms)
- [ ] 재생성 발생 시 LLM 1회 + embedding 1회 추가 (총 ~2-5초 추가 가능, 이는 허용 범위)
- [ ] embedding API 실패 시 검증 스킵하고 현재 결과 반환 (graceful degradation)
- [ ] pytest 커버리지 80% 이상

---

## 1. 기술 결정 목록

| # | 결정 | 선택 | 근거 |
|---|------|------|------|
| D1 | weak_part 추출 원본 | `reasoning` 필드 (fallback: `answer` 전체) | reasoning이 LLM이 판단한 답변 약점 요약. 빈 문자열(`""` 또는 whitespace-only)이면 answer 전체를 fallback으로 사용 |
| D2 | 유사도 함수 | 순수 Python `math.sqrt` cosine similarity | numpy/scipy 의존성 추가 금지 (엔진 경량 유지) |
| D3 | 임베딩 호출 방식 | `get_embeddings([followup_q, weak_part])` 배치 1회 호출 | `get_embeddings`가 이미 배치 지원. 2회 개별 호출 대비 latency 절반 |
| D4 | 동기/비동기 | 모든 함수 동기(sync) | `generate_followup()`, `get_embeddings()` 모두 동기 함수. async 도입 불필요 |
| D5 | threshold 상수화 | `OVERLAP_THRESHOLD = 0.5` named constant | magic number 제거 (Architect required) |
| D6 | embedding 실패 처리 | try/except로 감싸고 검증 스킵, 현재 결과 반환 | graceful degradation. 예외 전파 금지 (Critic required) |
| D7 | retry 로깅 | `logging.info` — attempt, score, threshold 기록 | Architect required. 디버깅·모니터링 용도 |
| D8 | process_answer overlap 미적용 | 코드 주석으로 이유 명시 | Architect required. process_answer 경로는 shouldFollowUp 판단만 수행하므로 overlap 검증 불필요 |

---

## 2. 파일별 변경 목록

| 파일 | 상태 | 변경 내용 |
|------|------|----------|
| `engine/app/analyzers/overlap.py` | **신규** | `cosine_similarity(a, b) -> float` 순수 Python 구현 |
| `engine/app/analyzers/followup_validator.py` | **신규** | `OVERLAP_THRESHOLD`, `validate_followup_overlap()` 검증 함수 |
| `engine/app/analyzers/__init__.py` | 수정 | 신규 모듈 re-export 추가 |
| `engine/app/services/interview_service.py` | 수정 | `generate_followup()`에 검증 루프 삽입, process_answer 주석 추가 |
| `engine/tests/unit/analyzers/test_overlap.py` | **신규** | cosine_similarity 단위 테스트 |
| `engine/tests/unit/analyzers/test_followup_validator.py` | **신규** | validate_followup_overlap 단위 테스트 (embedding 실패 포함) |
| `engine/tests/unit/services/test_interview_service.py` | 수정 | generate_followup overlap 검증 통합 테스트 추가 |
| `engine/.ai.md` | 수정 | overlap 검증 계약 문서화 |

---

## 3. 핵심 함수 시그니처

```python
# engine/app/analyzers/overlap.py
def cosine_similarity(a: list[float], b: list[float]) -> float:
    """두 벡터의 코사인 유사도 반환. zero vector 시 0.0 반환."""
    ...

# engine/app/analyzers/followup_validator.py
import logging

OVERLAP_THRESHOLD: float = 0.5
MAX_REGENERATION_ATTEMPTS: int = 2

logger = logging.getLogger(__name__)

def validate_followup_overlap(
    followup_question: str,
    weak_part: str,
    generate_fn,           # Callable[[], tuple[FollowupResponse, UsageMetadata | None]]
    get_embeddings_fn,     # Callable[[list[str]], tuple[list[list[float]], None]]
) -> tuple:                # tuple[FollowupResponse, UsageMetadata | None]
    """
    followup_question과 weak_part의 semantic overlap을 검증.
    overlap < OVERLAP_THRESHOLD이면 재생성 (최대 MAX_REGENERATION_ATTEMPTS회).
    embedding 실패 시 현재 결과를 그대로 반환 (graceful degradation).
    """
    ...
```

---

## 4. 검증 루프 pseudocode

```
function validate_followup_overlap(followup_question, weak_part, generate_fn, get_embeddings_fn):
    current_question = followup_question
    current_response = None   # 최초 호출 시에는 이미 생성된 결과를 사용

    for attempt in range(MAX_REGENERATION_ATTEMPTS):
        # 1. 배치 임베딩 (2텍스트 1회 호출)
        try:
            embeddings, _ = get_embeddings_fn([current_question, weak_part])
            q_vec = embeddings[0]
            w_vec = embeddings[1]
        except Exception as e:
            logger.warning("embedding 실패, 검증 스킵: %s", e)
            return current_response or (initial_response, initial_usage)  # graceful degradation

        # 2. 코사인 유사도 계산
        score = cosine_similarity(q_vec, w_vec)

        # 3. 임계값 비교
        if score >= OVERLAP_THRESHOLD:
            logger.info("overlap 검증 통과: attempt=%d, score=%.4f, threshold=%.1f", attempt + 1, score, OVERLAP_THRESHOLD)
            return current_response or (initial_response, initial_usage)

        # 4. 미달 → 재생성
        logger.info("overlap 미달, 재생성: attempt=%d, score=%.4f, threshold=%.1f", attempt + 1, score, OVERLAP_THRESHOLD)
        current_response = generate_fn()
        current_question = current_response[0].followupQuestion

    # 5. 최대 재시도 초과 → 마지막 생성본 반환
    logger.info("최대 재생성 횟수 도달 (%d회), 마지막 결과 반환", MAX_REGENERATION_ATTEMPTS)
    return current_response
```

---

## 5. generate_followup 수정 pseudocode

```python
def generate_followup(question, answer, persona, resumeText, *, model=None):
    # 1. 규칙 기반 유형 분류 (기존)
    followup_type = _classify_followup_type(answer)

    # 2. LLM 꼬리질문 생성 (기존)
    data, raw_usage, llm_model = _check_followup(question, answer, persona, resumeText, model=model)

    initial_response = FollowupResponse(
        followupType=followup_type,
        followupQuestion=data.get("followupQuestion", ""),
        reasoning=data.get("reasoning", ""),
    )
    initial_usage = _usage_to_metadata(raw_usage, llm_model)

    # 3. weak_part 추출: reasoning → fallback answer
    reasoning = data.get("reasoning", "")
    weak_part = reasoning.strip() if reasoning.strip() else answer

    # 4. 재생성 클로저 정의
    def regenerate():
        d, u, m = _check_followup(question, answer, persona, resumeText, model=model)
        return FollowupResponse(
            followupType=followup_type,
            followupQuestion=d.get("followupQuestion", ""),
            reasoning=d.get("reasoning", ""),
        ), _usage_to_metadata(u, m)

    # 5. overlap 검증 루프
    from app.analyzers.followup_validator import validate_followup_overlap
    from app.services.embedding_service import get_embeddings

    return validate_followup_overlap(
        followup_question=initial_response.followupQuestion,
        weak_part=weak_part,
        generate_fn=regenerate,
        get_embeddings_fn=get_embeddings,
        initial_response=(initial_response, initial_usage),
    )
```

---

## 6. 단계별 구현 순서 (TDD)

### Step 1: cosine_similarity 순수 Python 구현

**테스트 먼저** — `engine/tests/unit/analyzers/test_overlap.py`

| 테스트 케이스 | 입력 | 기대 |
|--------------|------|------|
| 동일 벡터 | `([1,0,0], [1,0,0])` | `1.0` |
| 직교 벡터 | `([1,0], [0,1])` | `0.0` |
| 반대 벡터 | `([1,0], [-1,0])` | `-1.0` |
| zero vector (a) | `([0,0], [1,0])` | `0.0` |
| zero vector (both) | `([0,0], [0,0])` | `0.0` |
| 일반 유사도 | 임의 벡터 | `0.0 < result < 1.0` |

**구현** — `engine/app/analyzers/overlap.py`
- `math.sqrt` 사용, numpy/scipy 금지
- zero vector (norm == 0) 시 `0.0` 반환

**AC**: `pytest engine/tests/unit/analyzers/test_overlap.py -v` 전체 통과

---

### Step 2: validate_followup_overlap 검증 함수

**테스트 먼저** — `engine/tests/unit/analyzers/test_followup_validator.py`

| 테스트 케이스 | 시나리오 | 기대 |
|--------------|---------|------|
| overlap 충분 (>= 0.5) | mock embedding → score 0.8 | 초기 결과 반환, 재생성 0회 |
| overlap 부족 + 재생성 성공 | 1차 score 0.2 → 재생성 → 2차 score 0.7 | 재생성 결과 반환 |
| overlap 부족 + 최대 재시도 도달 | 매번 score 0.1 | MAX_REGENERATION_ATTEMPTS 후 마지막 결과 반환 |
| embedding 실패 (Exception) | get_embeddings_fn raises Exception | 현재 결과 반환, 예외 전파 없음 |
| embedding 실패 (첫 시도) | 첫 호출에서 Exception | 초기 결과 그대로 반환 |
| 빈 followup_question | `""` 입력 | embedding 호출은 수행 (빈 문자열도 임베딩 가능) |
| 로깅 확인 | 재생성 발생 시 | INFO 로그에 attempt, score, threshold 포함 |

**구현** — `engine/app/analyzers/followup_validator.py`
- `OVERLAP_THRESHOLD = 0.5` named constant
- `MAX_REGENERATION_ATTEMPTS = 2`
- `logging.getLogger(__name__)` 사용
- 검증 루프 (위 pseudocode 참조)
- `initial_response` 매개변수 추가 — 최초 생성 결과를 외부에서 주입

**AC**: `pytest engine/tests/unit/analyzers/test_followup_validator.py -v` 전체 통과

---

### Step 3: generate_followup 통합 + process_answer 주석

**테스트 먼저** — `engine/tests/unit/services/test_interview_service.py`에 추가

| 테스트 케이스 | 시나리오 | 기대 |
|--------------|---------|------|
| overlap 충분 시 재생성 없음 | mock embedding score 0.8 | LLM 1회 호출, 기존 결과 반환 |
| overlap 부족 시 재생성 | mock embedding score 0.2 → 0.7 | LLM 2회 호출 (초기 + 재생성 1회) |
| embedding 실패 시 기존 결과 반환 | get_embeddings raises | LLM 1회, 결과 정상 반환 |
| reasoning 빈 문자열 시 answer fallback | reasoning="" | weak_part로 answer 사용 |
| reasoning whitespace-only 시 answer fallback | reasoning="  \n  " | weak_part로 answer 사용 |

**구현 수정** — `engine/app/services/interview_service.py`
- `generate_followup()` 내부에 검증 루프 삽입 (위 pseudocode)
- `process_answer()` line 163-174 (shouldFollowUp 분기) 앞에 주석 추가:
  ```python
  # NOTE: process_answer 경로는 overlap 검증 미적용.
  # 이유: 이 경로는 shouldFollowUp 판단(LLM)의 followupQuestion을 그대로 사용하며,
  # generate_followup API와 달리 별도의 품질 검증이 불필요하다.
  # overlap 검증은 /api/interview/followup 전용 (generate_followup 함수).
  ```

**구현 수정** — `engine/app/analyzers/__init__.py`
- `cosine_similarity`, `validate_followup_overlap`, `OVERLAP_THRESHOLD` re-export 추가

**AC**:
- `pytest engine/tests/unit/services/test_interview_service.py -v` 전체 통과
- 기존 테스트 회귀 없음

---

### Step 4: .ai.md 문서 갱신 + 전체 회귀 테스트

**구현** — `engine/.ai.md`
- `/api/interview/followup` 엔드포인트 설명에 overlap 검증 동작 추가:
  - overlap < 0.5 시 자동 재생성 (최대 2회)
  - embedding 실패 시 검증 스킵 (graceful degradation)
  - `OVERLAP_THRESHOLD` 상수 위치: `app/analyzers/followup_validator.py`
- `app/analyzers/` 구조 설명에 `overlap.py`, `followup_validator.py` 추가

**AC**:
- `pytest engine/tests/ -v` 전체 통과
- `pytest engine/tests/ --cov=app --cov-report=term-missing` 커버리지 80% 이상

---

## 7. 주요 Edge Cases

| Edge Case | 처리 방식 |
|-----------|----------|
| `get_embeddings` 네트워크 오류 / API 오류 | try/except로 감싸고 검증 스킵. 현재 결과 반환. 예외 전파 금지 |
| `get_embeddings` 차원 불일치 (!=1024) | `get_embeddings` 내부에서 이미 ValueError raise → 위 try/except에서 포착 |
| `reasoning`이 `""` (빈 문자열) | `strip()` 후 비어있으면 `answer` 전체를 `weak_part`로 사용 |
| `reasoning`이 whitespace-only (`"  \n  "`) | `strip()` 후 비어있으므로 `answer` 전체를 `weak_part`로 사용 |
| zero vector 반환 (embedding 결과) | `cosine_similarity`에서 norm == 0 시 `0.0` 반환 → overlap 부족으로 판단 → 재생성 시도 |
| `followupQuestion`이 빈 문자열 | 빈 문자열도 embedding 가능 — zero/near-zero vector가 되어 overlap 부족 → 재생성 |
| 재생성해도 계속 overlap 부족 | MAX_REGENERATION_ATTEMPTS(2회) 후 마지막 결과 반환. 무한루프 없음 |
| `OPENROUTER_API_KEY` 미설정 | `get_embeddings` 내부에서 ValueError raise → try/except 포착 → 검증 스킵 |

---

## 8. Success Criteria

| AC | 검증 방법 |
|----|----------|
| overlap < 0.5 시 자동 재생성 | `pytest engine/tests/unit/analyzers/test_followup_validator.py::test_regeneration_on_low_overlap -v` |
| 재생성 최대 2회 제한 | `pytest engine/tests/unit/analyzers/test_followup_validator.py::test_max_regeneration_attempts -v` |
| 재생성 미발생 시 latency 증가 1초 이내 | embedding mock 기준 추가 호출 1회만 발생 확인 (실제 latency는 통합 테스트 범위) |
| embedding 실패 시 graceful degradation | `pytest engine/tests/unit/analyzers/test_followup_validator.py::test_embedding_failure_graceful -v` |
| reasoning 빈 문자열 시 answer fallback | `pytest engine/tests/unit/services/test_interview_service.py::test_empty_reasoning_fallback -v` |
| retry 이벤트 로깅 | `pytest engine/tests/unit/analyzers/test_followup_validator.py::test_logging_on_retry -v` (caplog 사용) |
| OVERLAP_THRESHOLD named constant | grep 확인: `OVERLAP_THRESHOLD = 0.5` in `followup_validator.py` |
| process_answer 주석 | grep 확인: `process_answer 경로는 overlap 검증 미적용` in `interview_service.py` |
| 기존 테스트 회귀 없음 | `pytest engine/tests/ -v` 전체 통과 |
| 커버리지 80% 이상 | `pytest engine/tests/ --cov=app.analyzers.overlap --cov=app.analyzers.followup_validator --cov-report=term-missing` |

---

## Critic/Architect 피드백 반영 체크리스트

- [x] **(Critical)** 모든 함수 동기(sync) — async 없음
- [x] **(Critical)** retry 이벤트 로깅: attempt, score, threshold를 INFO 레벨로
- [x] **(Critical)** process_answer overlap 미적용 이유 코드 주석 명시
- [x] **(Critical)** `OVERLAP_THRESHOLD = 0.5` named constant
- [x] **(Critical)** embedding API 실패 시 graceful degradation (try/except, 예외 전파 금지)
- [x] **(High)** latency AC 현실화: 재생성 미발생/발생 분리 기술
- [x] **(Medium)** reasoning 빈 문자열 정의: `strip()` 후 비어있으면 answer fallback
- [x] **(Optional)** 배치 임베딩: `get_embeddings([followup_q, weak_part])` 단일 호출
- [x] **(Optional)** embedding 실패 graceful degradation 유닛 테스트 명시
