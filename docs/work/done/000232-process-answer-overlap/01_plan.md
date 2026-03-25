# [#232] fix: [engine] process_answer overlap 검증 누락 — validate_followup_overlap 연결 — 구현 계획

> 작성: 2026-03-24

---

## 완료 기준

- [ ] `process_answer`에서 `shouldFollowUp=True`일 때 `validate_followup_overlap` 적용 — overlap < 0.5 시 `_check_followup` 재호출 (최대 2회)
- [ ] `process_answer` 경로의 NOTE 주석 제거 및 로그 추가 (overlap score, 재생성 여부)
- [ ] pytest 기존 `test_interview_service.py` 케이스 통과 + overlap 검증 케이스 추가

---

## 구현 계획

### 배경 요약

`validate_followup_overlap`은 #199에서 구현됐지만 `/api/interview/followup` 전용(`generate_followup`)에만 연결됐고, 실제 면접 플로우인 `process_answer`에는 NOTE 주석으로 의도적 미적용 처리됨. 프론트엔드가 `process_answer` 경로만 사용하므로 검증 로직이 한 번도 실행되지 않는 상태.

### 참조 패턴

`generate_followup` (line 201-243)이 이미 동일한 패턴을 구현함:
1. `_check_followup` 호출 → `(dict, usage, model)` 반환
2. `FollowupResponse` 임시 객체 생성
3. `weak_part = reasoning.strip() or answer`
4. `_regenerate` 클로저 정의 (`_check_followup` 재호출)
5. `validate_followup_overlap` 호출
6. 결과 반환

`process_answer`에서도 동일한 패턴을 적용하되, 최종 반환은 `InterviewAnswerResponse`로 래핑.

---

### Step 1: `engine/app/services/interview_service.py` 수정

#### 1-1. `import logging` 추가 (파일 상단)

```python
import logging
```

`logger = logging.getLogger(__name__)` 도 모듈 레벨에 추가.

#### 1-2. `process_answer`의 `shouldFollowUp=True` 분기 수정

**현재 (line 152-173):**
```python
if trailing < MAX_FOLLOWUPS:
    # NOTE: process_answer 경로는 overlap 검증 미적용.
    # 이유: shouldFollowUp 판단(LLM)의 followupQuestion을 그대로 사용하며,
    # /api/interview/followup 전용 generate_followup과 달리 별도 품질 검증 불필요.
    followup_data, followup_raw_usage, followup_model = _check_followup(
        currentQuestion, currentAnswer, currentPersona, resumeText, model=model
    )
else:
    followup_data, followup_raw_usage, followup_model = {"shouldFollowUp": False}, None, ""

if followup_data["shouldFollowUp"]:
    return InterviewAnswerResponse(
        nextQuestion=QuestionWithPersona(
            ...
            question=followup_data.get("followupQuestion", ""),
            type="follow_up",
        ),
        ...
    ), _usage_to_metadata(followup_raw_usage, followup_model)
```

**변경 후:**
```python
if trailing < MAX_FOLLOWUPS:
    followup_data, followup_raw_usage, followup_model = _check_followup(
        currentQuestion, currentAnswer, currentPersona, resumeText, model=model
    )
else:
    followup_data, followup_raw_usage, followup_model = {"shouldFollowUp": False}, None, ""

if followup_data["shouldFollowUp"]:
    reasoning = followup_data.get("reasoning", "")
    weak_part = reasoning.strip() or currentAnswer

    initial_fr = FollowupResponse(
        followupType=_classify_followup_type(currentAnswer),
        followupQuestion=followup_data.get("followupQuestion", ""),
        reasoning=reasoning,
    )
    initial_usage = _usage_to_metadata(followup_raw_usage, followup_model)

    def _regenerate_followup():
        d, u, m = _check_followup(
            currentQuestion, currentAnswer, currentPersona, resumeText, model=model
        )
        return FollowupResponse(
            followupType=_classify_followup_type(currentAnswer),
            followupQuestion=d.get("followupQuestion", ""),
            reasoning=d.get("reasoning", ""),
        ), _usage_to_metadata(u, m)

    validated_fr, validated_usage = validate_followup_overlap(
        followup_question=initial_fr.followupQuestion,
        weak_part=weak_part,
        generate_fn=_regenerate_followup,
        get_embeddings_fn=get_embeddings,
        initial_response=(initial_fr, initial_usage),
    )

    logger.info(
        "process_answer overlap 검증 완료: followupQuestion=%s",
        validated_fr.followupQuestion,
    )

    return InterviewAnswerResponse(
        nextQuestion=QuestionWithPersona(
            persona=currentPersona,
            personaLabel=PERSONA_LABELS[currentPersona],
            question=validated_fr.followupQuestion,
            type="follow_up",
        ),
        updatedQueue=list(questionsQueue),
        sessionComplete=False,
    ), validated_usage
```

**핵심 변경:**
- NOTE 주석 3줄 제거
- `FollowupResponse` 래퍼로 `validate_followup_overlap` 호출
- 결과에서 `.followupQuestion` 추출 → `InterviewAnswerResponse` 구성
- `logger.info` 로그 추가

---

### Step 2: `engine/tests/unit/services/test_interview_service.py` 수정

#### 2-1. 기존 테스트 호환성

`validate_followup_overlap`은 embedding 실패 시 fail-safe로 초기 결과를 반환함 (`followup_validator.py:40-42`). 테스트 환경에서 `get_embeddings`가 mock되지 않으면 예외 발생 → fail-safe 작동 → 기존 테스트 자동 통과.

변경 필요 없음.

#### 2-2. `TestProcessAnswerOverlap` 클래스 추가

`TestGenerateFollowupOverlap` (line 271-374) 패턴을 참조. 차이점: 반환값이 `InterviewAnswerResponse`이므로 `.nextQuestion.question`으로 검증.

추가할 테스트:

1. **`test_overlap_sufficient_no_regeneration`**
   - `get_embeddings` mock: overlap=0.8 반환
   - `_check_followup` 1회만 호출 확인
   - `result.nextQuestion.question == "좋은 질문"` 확인

2. **`test_overlap_low_triggers_regeneration`**
   - `get_embeddings` mock: 첫 호출 overlap=0.2, 두 번째 호출 overlap=0.8
   - `_check_followup` 2회 호출 확인
   - 재생성된 질문이 반환됨 확인

3. **`test_embedding_failure_returns_initial_result`**
   - `get_embeddings` mock: RuntimeError 발생
   - 초기 질문이 그대로 반환됨 확인 (예외 전파 없음)

---

### Step 3: 검증

```bash
cd engine
pytest tests/unit/services/test_interview_service.py -v
```

기존 케이스 + 신규 `TestProcessAnswerOverlap` 케이스 모두 통과 확인.

---

## 트레이드오프 기록

- **레이턴시 증가**: `process_answer`는 hot path. 최악 경우 LLM 3회 + embedding 2회. `generate_followup`도 동일 비용을 이미 부담하며, overlap 검증의 품질 이점이 우선.
- **코드 중복**: `generate_followup`과 유사한 패턴 반복. 헬퍼 추출은 이 fix 범위 밖으로 별도 이슈로 분리.
- **기존 테스트 취약성**: fail-safe 덕분에 기존 테스트가 통과하지만, 명시적 mock 없이 통과하는 구조. 신규 테스트는 명시적 mock 사용.
