# [#232] 테스트 결과

> 작성: 2026-03-25

---

## 테스트 실행 결과

```
pytest tests/unit/services/test_interview_service.py -v
30 passed in 3.55s
```

기존 27개 케이스 모두 통과 + 신규 3개 케이스 추가.

---

## 신규 테스트: `TestProcessAnswerOverlap`

`process_answer`의 `shouldFollowUp=True` 경로에 `validate_followup_overlap` 연결 검증.

### Case 1 — overlap 충분 (재생성 없음)

```
pytest tests/unit/services/test_interview_service.py::TestProcessAnswerOverlap::test_overlap_sufficient_no_regeneration --log-cli-level=INFO
```

```
INFO  followup_validator.py  overlap 검증 통과: attempt=1, score=0.8000, threshold=0.5
INFO  interview_service.py   process_answer overlap 검증 완료: followupQuestion=좋은 꼬리질문
PASSED
```

- get_embeddings mock: score=0.8
- LLM 호출 1회, 재생성 없음
- 첫 번째 꼬리질문 그대로 반환

### Case 2 — overlap 미달 → 재생성 1회

```
pytest tests/unit/services/test_interview_service.py::TestProcessAnswerOverlap::test_overlap_low_triggers_regeneration --log-cli-level=INFO
```

```
INFO  followup_validator.py  overlap 미달, 재생성: attempt=1, score=0.2000, threshold=0.5
INFO  followup_validator.py  overlap 검증 통과: attempt=2, score=0.8000, threshold=0.5
INFO  interview_service.py   process_answer overlap 검증 완료: followupQuestion=재생성 질문
PASSED
```

- get_embeddings mock: 첫 호출 score=0.2 → 두 번째 score=0.8
- LLM 호출 2회 (재생성 1회)
- 재생성된 꼬리질문 반환

### Case 3 — embedding 실패 → 초기 결과 반환

```
pytest tests/unit/services/test_interview_service.py::TestProcessAnswerOverlap::test_embedding_failure_returns_initial_result --log-cli-level=INFO
```

```
WARNING followup_validator.py  embedding 실패, 검증 스킵: API 장애
INFO    interview_service.py   process_answer overlap 검증 완료: followupQuestion=초기 질문
PASSED
```

- get_embeddings: RuntimeError 발생
- graceful degradation — 예외 전파 없이 초기 꼬리질문 반환

---

## 기존 테스트 호환성

| 테스트 | 결과 | 비고 |
|--------|------|------|
| test_process_answer_returns_followup_when_insufficient | PASS | embedding 실패 시 fail-safe 작동 |
| test_process_answer_followup_question_fallback_when_key_missing | PASS | 동일 |
| 나머지 25개 기존 케이스 | PASS | 영향 없음 |

---

## 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `engine/app/services/interview_service.py` | `process_answer` overlap 검증 삽입, NOTE 주석 제거, `import logging` 추가 |
| `engine/tests/unit/services/test_interview_service.py` | `TestProcessAnswerOverlap` 클래스 추가 (3개 케이스) |
| `engine/.ai.md` | `/api/interview/answer` overlap 검증 동작 계약 추가 |
