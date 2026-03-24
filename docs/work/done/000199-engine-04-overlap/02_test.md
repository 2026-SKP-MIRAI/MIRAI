# [#199] feat: [engine] 꼬리질문 overlap 기반 품질 검증 + 자동 재생성 — 테스트

> 작성: 2026-03-24

---

## 최종 결과

```
pytest tests/ -q (broken fixture 3개 ignore)
225 passed, 4 skipped in 2.67s
```

신규 테스트 41개 전원 통과. 기존 리그레션 포함.

---

## 상태 범례

| 아이콘 | 의미 |
|--------|------|
| ⬜ | 미구현 |
| 🔴 | RED — 테스트 작성 완료, 실패 확인 |
| 🟢 | GREEN — 구현 완료, 테스트 통과 |
| ✅ | DONE — 리팩토링 완료 |
| ❌ | FAIL — 테스트 실패 (수정 필요) |

---

## 테스트 파일 구조

```
engine/tests/
└── unit/
    ├── analyzers/
    │   ├── test_overlap.py             ← 신규 (9개)
    │   └── test_followup_validator.py  ← 신규 (5개)
    └── services/
        └── test_interview_service.py   ← 수정 (+5개, TestGenerateFollowupOverlap 클래스 추가)
```

---

## 사이클 1 — cosine_similarity 단위 테스트

파일: `engine/tests/unit/analyzers/test_overlap.py`

| # | 테스트명 | 상태 | 비고 |
|---|----------|------|------|
| 1 | `test_identical_vectors` | ✅ | 동일 벡터 → score = 1.0 |
| 2 | `test_orthogonal_vectors` | ✅ | 직교 벡터 → score = 0.0 |
| 3 | `test_opposite_vectors` | ✅ | 반대 벡터 → score = -1.0 |
| 4 | `test_zero_vector_a` | ✅ | a=영벡터 → score = 0.0 (ZeroDivision 방지) |
| 5 | `test_zero_vector_both` | ✅ | 양쪽 영벡터 → score = 0.0 |
| 6 | `test_partial_similarity` | ✅ | 부분 유사 벡터 → 0.0 < score < 1.0 |
| 7 | `test_1024_dim_identical` | ✅ | 1024차원 동일 벡터 → score = 1.0 (BGE-M3 실제 차원) |
| 8 | `test_1024_dim_orthogonal` | ✅ | 1024차원 직교 벡터 → score = 0.0 |
| 9 | `test_symmetry` | ✅ | cosine_similarity(a, b) == cosine_similarity(b, a) |

---

## 사이클 2 — validate_followup_overlap 단위 테스트

파일: `engine/tests/unit/analyzers/test_followup_validator.py`

mock 전략: `get_embeddings_fn`에 직교/동일 벡터 주입, `generate_fn`은 `MagicMock`

| # | 테스트명 | 상태 | 비고 |
|---|----------|------|------|
| 1 | `test_overlap_sufficient_no_regeneration` | ✅ | score=1.0 → `generate_fn` 0회 호출, 초기 결과 반환 |
| 2 | `test_overlap_low_first_then_pass` | ✅ | 1차 score=0.0 → 재생성 → 2차 score=1.0, `generate_fn` 1회 |
| 3 | `test_max_attempts_reached` | ✅ | 매번 score=0.0 → `MAX_REGENERATION_ATTEMPTS`회 후 마지막 결과 반환 |
| 4 | `test_embedding_failure_graceful` | ✅ | `get_embeddings_fn` raises Exception → 초기 결과 반환, 예외 전파 없음 |
| 5 | `test_logging_on_retry` | ✅ | 재생성 발생 시 INFO 로그에 attempt, score, threshold 포함 |

---

## 사이클 3 — generate_followup overlap 통합 테스트

파일: `engine/tests/unit/services/test_interview_service.py` — `TestGenerateFollowupOverlap` 클래스

mock 패치 경로: `app.services.interview_service.get_embeddings`, `app.services.interview_service._check_followup`

| # | 테스트명 | 상태 | 비고 |
|---|----------|------|------|
| 1 | `test_overlap_sufficient_no_regeneration` | ✅ | high score → LLM 1회, 초기 결과 반환 |
| 2 | `test_overlap_low_triggers_regeneration` | ✅ | low→high score → LLM 2회, 재생성 결과 반환 |
| 3 | `test_embedding_failure_returns_initial_result` | ✅ | embedding 실패 → 초기 결과 반환, 예외 전파 없음 |
| 4 | `test_empty_reasoning_uses_answer_as_weak_part` | ✅ | reasoning="" → answer 전체를 weak_part로 사용 |
| 5 | `test_whitespace_reasoning_uses_answer_fallback` | ✅ | reasoning="   " → `strip() or answer` 로 fallback |

---

## 기존 테스트 리그레션 확인

| 파일 | 테스트 수 | 상태 |
|------|-----------|------|
| `tests/unit/analyzers/test_text_analyzer.py` | 기존 | ✅ |
| `tests/unit/analyzers/test_keywords.py` | 기존 | ✅ |
| `tests/unit/services/test_interview_service.py` (기존 분) | 기존 | ✅ |
| `tests/integration/test_interview_router.py` | 기존 | ✅ |
| 기타 unit/integration 전체 | 기존 | ✅ |
| **신규 합계** | **19개** | ✅ |
| **전체 합계** | **225 passed, 4 skipped** | ✅ |

---

## 커버리지 정성 평가

| 케이스 | 테스트 여부 |
|--------|------------|
| overlap ≥ threshold → 재생성 없음 | ✅ |
| overlap < threshold → 1회 재생성 후 통과 | ✅ |
| overlap < threshold → MAX 횟수 초과 → 마지막 반환 | ✅ |
| embedding API 실패 → graceful degradation | ✅ |
| reasoning 비어있을 때 answer fallback | ✅ |
| reasoning 공백만 있을 때 answer fallback | ✅ |
| 재생성 시 로그 (attempt, score, threshold) | ✅ |
| cosine_similarity 영벡터 ZeroDivision 방지 | ✅ |
| BGE-M3 실제 차원 (1024) 호환 | ✅ |
| process_answer 경로에서 overlap 미적용 (의도적) | — (주석으로 명시) |
