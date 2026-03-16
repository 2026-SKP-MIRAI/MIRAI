# 000090 — 검증 결과

## 실행 환경

| 항목 | 값 |
|------|-----|
| 실행일 | 2026-03-16 |
| Python | 3.12.10 |
| pytest | 9.0.2 |

---

## 아키텍처 불변식 검증

| # | 불변식 | 결과 | 근거 |
|---|--------|------|------|
| 1 | 인증 로직 없음 (engine에 JWT·Bearer·auth 없음) | ✅ PASS | `engine/app/routers/resume.py` — 인증 관련 import 없음. `engine/.ai.md`에 "인증 로직 포함 금지" 명시 |
| 2 | 외부 AI API 호출은 엔진에서만 | ✅ PASS | `services/` 하위 Python 파일 전수 검색 → LLM 호출 없음. 엔진 `app/services/llm_client.py`가 단일 진입점 |
| 3 | 서비스 간 직접 통신 금지 | ✅ N/A | 이번 태스크 변경 파일은 engine 전용. 서비스 레이어 변경 없음 |
| 4 | DB는 서비스가 소유 — engine은 stateless | ✅ PASS | `engine/app/main.py` 포함 전체 엔진 파일에 DB 관련 코드 없음. `feedback_service.py`는 순수 함수형 stateless |
| 5 | 테스트 없는 PR 머지 금지 | ✅ PASS | 단위 17개 + 통합 9개 = 26개 테스트 구현됨 |

---

## 백엔드 검증 (pytest)

### 실행 명령
```
python -m pytest tests/unit/services/test_feedback_service.py tests/integration/test_resume_feedback_router.py -v --tb=short
```

### 결과: 26 passed in 1.07s

#### 단위 테스트 (17개)

| # | 테스트명 | 결과 |
|---|---------|------|
| 1 | test_generate_resume_feedback_returns_valid_response | ✅ PASS |
| 2 | test_generate_resume_feedback_scores_within_range | ✅ PASS |
| 3 | test_generate_resume_feedback_strengths_count | ✅ PASS |
| 4 | test_generate_resume_feedback_weaknesses_count | ✅ PASS |
| 5 | test_generate_resume_feedback_suggestions_structure | ✅ PASS |
| 6 | test_generate_resume_feedback_score_over_100_raises_parse_error | ✅ PASS |
| 7 | test_generate_resume_feedback_score_negative_raises_parse_error | ✅ PASS |
| 8 | test_generate_resume_feedback_strengths_truncated_to_3 | ✅ PASS |
| 9 | test_generate_resume_feedback_weaknesses_truncated_to_3 | ✅ PASS |
| 10 | test_generate_resume_feedback_empty_strengths_raises_parse_error | ✅ PASS |
| 11 | test_generate_resume_feedback_empty_weaknesses_raises_parse_error | ✅ PASS |
| 12 | test_generate_resume_feedback_empty_suggestions_raises_parse_error | ✅ PASS |
| 13 | test_generate_resume_feedback_llm_error_raises_llm_error | ✅ PASS |
| 14 | test_generate_resume_feedback_invalid_json_raises_parse_error | ✅ PASS |
| 15 | test_generate_resume_feedback_missing_scores_raises_parse_error | ✅ PASS |
| 16 | test_generate_resume_feedback_partial_scores_raises_parse_error | ✅ PASS |
| 17 | test_generate_resume_feedback_null_score_value_raises_parse_error | ✅ PASS |

#### 통합 테스트 (9개)

| # | 테스트명 | 결과 |
|---|---------|------|
| 1 | test_resume_feedback_200_full_fields | ✅ PASS |
| 2 | test_resume_feedback_200_scores_five_keys | ✅ PASS |
| 3 | test_resume_feedback_400_missing_resume_text | ✅ PASS |
| 4 | test_resume_feedback_400_missing_target_role | ✅ PASS |
| 5 | test_resume_feedback_400_empty_resume_text | ✅ PASS |
| 6 | test_resume_feedback_400_empty_target_role | ✅ PASS |
| 7 | test_resume_feedback_500_llm_error | ✅ PASS |
| 8 | test_resume_feedback_500_parse_error | ✅ PASS |
| 9 | test_resume_feedback_500_empty_suggestions_raises_error | ✅ PASS |

### 참고: 기존 테스트 수집 오류 (이번 태스크 범위 외)
- `tests/integration/test_practice_router.py` — fixture 파일 없음 (`mock_practice_feedback_single.json`)
- `tests/integration/test_report_router.py` — fixture 파일 없음 (`mock_report_response.json`)
- `tests/unit/services/test_report_service.py` — fixture 파일 없음 (`mock_report_response.json`)
- 이 오류들은 이번 태스크(000090) 범위 밖의 기존 문제이며, 이번 구현에서 발생시킨 회귀가 아님

### 엔드포인트 스키마

**POST /api/resume/feedback**

요청:
```json
{ "resumeText": "string (min_length=1)", "targetRole": "string (min_length=1)" }
```

응답 (200):
```json
{
  "scores": {
    "specificity": 0-100,
    "achievementClarity": 0-100,
    "logicStructure": 0-100,
    "roleAlignment": 0-100,
    "differentiation": 0-100
  },
  "strengths": ["string", "string"],
  "weaknesses": ["string", "string"],
  "suggestions": [{ "section": "str", "issue": "str", "suggestion": "str" }]
}
```

에러 처리:
- 400: 필드 누락 / 빈 문자열 (Pydantic validation)
- 500: LLMError / ResumeFeedbackParseError

---

## 서비스 레이어 검증

| # | 항목 | 결과 | 근거 |
|---|------|------|------|
| 1 | `_validate_score()` 존재 — clamp 없이 범위 초과 시 ParseError | ✅ PASS | `feedback_service.py:13-16` — `isinstance(val, int) or not (0 <= val <= 100)` 검사, ParseError raise |
| 2 | `_require_str_list()` 존재 — safe_list 없이 min_count 미달 시 ParseError | ✅ PASS | `feedback_service.py:47-54` — `[:max_count]` truncate + min_count 검증, ParseError raise |
| 3 | suggestions 빈 배열 → ParseError (fallback 삽입 아님) | ✅ PASS | `feedback_service.py:72-73` — `if not suggestions: raise ResumeFeedbackParseError(...)`. 테스트 9번 500 반환 확인 |
| 4 | `config.py` extra="ignore" 설정 | ✅ PASS | `config.py:5` — `ConfigDict(env_file=".env", extra="ignore")` |
| 5 | `engine/.ai.md` 최신화 | ✅ PASS | Phase 3 `/api/resume/feedback` 엔드포인트 계약, ResumeFeedbackParseError 예외 계층, services/.ai.md 구조 모두 반영됨 |
| 6 | `engine/app/services/.ai.md` 최신화 | ✅ PASS | `feedback_service.py` 항목 추가, `generate_resume_feedback(resumeText, targetRole)` 시그니처 기재됨 |
| 7 | `engine/app/routers/.ai.md` 최신화 | ✅ PASS | `resume.py`에 `/api/resume/feedback` 라우트 반영 기재됨 |

### 불일치 항목 (문서 오류)

`engine/.ai.md` line 130:
> "suggestions 최소 1개 보장: LLM 빈 배열 반환 시 fallback SuggestionItem 자동 삽입"

실제 구현: fallback 삽입이 아닌 `ResumeFeedbackParseError` raise (엄격 검증 정책).
테스트 `test_resume_feedback_500_empty_suggestions_raises_error`도 500 반환을 검증함.
→ 문서 오류로 판정. 아래 수정 필요.

---

## 종합 판정

✅ **PASS** — 26/26 테스트 통과, 아키텍처 불변식 5개 모두 준수, 서비스 레이어 엄격 검증 정책 구현 확인.

단, `engine/.ai.md` line 130 문서 오류(fallback 삽입 → ParseError raise로 수정 필요) 발견.
코드 동작 자체는 정확하므로 문서 수정 후 완료 처리 권장.
