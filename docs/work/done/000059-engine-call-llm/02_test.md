# [#59] fix: call_llm max_tokens 기본값 1024 → 2048 상향 — 테스트

> 작성: 2026-03-12 | 총 89개 (신규 3 + 기존 86) | 플랜: `01_plan.md`

---

## 최종 결과

```
pytest tests/ -q
89 passed in X.XXs
```

전체 89개 통과. 리그레션(기존 86개 테스트) 포함.

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
    └── services/
        └── test_llm_client.py   ← 신규 (3개)
```

---

## 사이클 1 — call_llm 기본값 및 파라미터 전달 검증

파일: `engine/tests/unit/services/test_llm_client.py`

mock 패치 경로: `"app.services.llm_client.OpenAI"`

| # | 테스트명 | 상태 | 비고 |
|---|----------|------|------|
| 1 | `test_call_llm_default_max_tokens_is_2048` | ✅ | 함수 시그니처에서 `max_tokens` 기본값이 2048인지 확인 |
| 2 | `test_call_llm_passes_max_tokens_2048_by_default` | ✅ | 기본 호출 시 OpenAI API에 `max_tokens=2048` 전달 확인 |
| 3 | `test_call_llm_passes_custom_max_tokens` | ✅ | `max_tokens=4096` 지정 시 해당 값이 그대로 전달되는지 확인 |

---

## 기존 테스트 리그레션 확인

| 파일 | 테스트 수 | 상태 | 비고 |
|------|-----------|------|------|
| `tests/unit/parsers/test_pdf_parser.py` | 7 | ✅ | |
| `tests/unit/services/test_llm_service.py` | 8 | ✅ | |
| `tests/unit/services/test_output_parser.py` | 10 | ✅ | |
| `tests/unit/services/test_interview_service.py` | 17 | ✅ | |
| `tests/unit/services/test_report_service.py` | 16 | ✅ | |
| `tests/integration/test_resume_questions_route.py` | 9 | ✅ | |
| `tests/integration/test_interview_router.py` | 11 | ✅ | |
| `tests/integration/test_report_router.py` | 8 | ✅ | |
| `tests/unit/services/test_llm_client.py` | **3** | ✅ | 신규 |
| **합계** | **89** | ✅ | |

---

## 커버리지 정성 평가

| 케이스 | 테스트 여부 |
|--------|------------|
| `max_tokens` 기본값 = 2048 | ✅ 시그니처 검사 1개 |
| 기본 호출 시 `max_tokens=2048` API 전달 | ✅ mock 검증 1개 |
| 커스텀 `max_tokens` 값 정상 전달 | ✅ mock 검증 1개 |

---

## 모킹 전략

```python
# LLM 성공 mock
fake = MagicMock()
fake.chat.completions.create.return_value.choices = [
    MagicMock(message=MagicMock(content="response"))
]
patch("app.services.llm_client.OpenAI", return_value=fake)

# 호출 인자 검증
_, kwargs = fake.chat.completions.create.call_args
assert kwargs["max_tokens"] == 2048
```

---

## 작업 로그

| 시각 | 내용 |
|------|------|
| 2026-03-12 | `llm_client.py` `max_tokens` 기본값 1024 → 2048 변경 |
| 2026-03-12 | `engine/tests/unit/services/test_llm_client.py` 신규 작성 (3개) |
| 2026-03-12 | 전체 89개 GREEN 확인 |
