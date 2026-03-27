# [#293] feat: [seung][DE] 합격 자소서 임베딩 자동화 파이프라인 — 테스트 결과

> 작성: 2026-03-27

---

## 최종 테스트 결과

### pytest 단위 테스트 (Python)

```
collected 8 items

tests/test_seung_resume_embed_dag.py::test_find_new_submissions_skip_no_db_url PASSED
tests/test_seung_resume_embed_dag.py::test_find_new_submissions_skip_no_seung_db_url PASSED
tests/test_seung_resume_embed_dag.py::test_find_new_submissions_skip_no_records PASSED
tests/test_seung_resume_embed_dag.py::test_find_new_submissions_returns_ids PASSED
tests/test_seung_resume_embed_dag.py::test_embed_batch_calls_engine_in_batches PASSED
tests/test_seung_resume_embed_dag.py::test_embed_batch_skip_propagation PASSED
tests/test_seung_resume_embed_dag.py::test_upsert_vectors_no_duplicate PASSED
tests/test_seung_resume_embed_dag.py::test_mark_processed_updates_db PASSED

8 passed in 0.08s
```

**테스트별 결과:**

| 파일 | 테스트명 | 결과 | 검증 내용 |
|------|---------|------|-----------|
| `tests/test_seung_resume_embed_dag.py` | `test_find_new_submissions_skip_no_db_url` | ✅ | `RAG_DATABASE_URL` 미설정 → `AirflowSkipException` |
| `tests/test_seung_resume_embed_dag.py` | `test_find_new_submissions_skip_no_seung_db_url` | ✅ | `SEUNG_DATABASE_URL` 미설정 → `AirflowSkipException` (임베딩 비용 낭비 방지) |
| `tests/test_seung_resume_embed_dag.py` | `test_find_new_submissions_skip_no_records` | ✅ | `processed=false` 레코드 없음 → `AirflowSkipException` |
| `tests/test_seung_resume_embed_dag.py` | `test_find_new_submissions_returns_ids` | ✅ | `processed=false` 2건 → XCom에 `submission_ids=[1, 2]` push |
| `tests/test_seung_resume_embed_dag.py` | `test_embed_batch_calls_engine_in_batches` | ✅ | 250건 → 엔진 3회 호출 (100+100+50), 임시 파일 생성 |
| `tests/test_seung_resume_embed_dag.py` | `test_embed_batch_skip_propagation` | ✅ | `submission_ids=None` → `AirflowSkipException` 전파 |
| `tests/test_seung_resume_embed_dag.py` | `test_upsert_vectors_no_duplicate` | ✅ | `ON CONFLICT DO NOTHING` — rowcount=0 시 `upserted_count=0` push |
| `tests/test_seung_resume_embed_dag.py` | `test_mark_processed_updates_db` | ✅ | `UPDATE "ResumeSubmission" SET processed=true WHERE id = ANY(...)` 호출 확인 |

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

## 변경 파일 및 수정 내용

### 신규 파일

| 파일 | 내용 | 결과 |
|------|------|------|
| `services/seung/airflow/dags/seung_resume_embed_dag.py` | 합격 자소서 임베딩 DAG (find → embed → upsert → mark) | ✅ |
| `services/seung/airflow/tests/test_seung_resume_embed_dag.py` | DAG 단위 테스트 8개 | ✅ |

### 수정 파일

| 파일 | 변경 | 결과 |
|------|------|------|
| `services/seung/airflow/.ai.md` | `seung_resume_embed_dag` 추가, SQLite 기술부채 트리거 기록, 아키텍처 불변식 4 예외 업데이트 | ✅ |
| `services/seung/airflow/docker-compose.yml` | `RAG_DATABASE_URL`, `SEUNG_DATABASE_URL` 변수 항목 추가 | ✅ |
| `services/seung/airflow/requirements.txt` | `requests>=2.28.0,<3.0.0` 추가 | ✅ |

---

## TDD 사이클

### RED → GREEN

- `test_find_new_submissions_skip_no_db_url` ~ `test_mark_processed_updates_db` 7개 작성 → DAG 미구현으로 RED → DAG 구현 → GREEN
- 코드 리뷰 피드백 반영 (4건):
  - `ds` 기반 tmp 파일명 → `run_id` 기반으로 수정 (같은 날 재실행 충돌 방지)
  - `SEUNG_DATABASE_URL` 조기 검증 추가 → `test_find_new_submissions_skip_no_seung_db_url` 신규 추가
  - docker-compose 누락 변수 추가
  - `_xcom_pushes` helper falsy 0 버그 수정 (`"value" in c.kwargs` 방식)
- 기존 analytics DAG 테스트 4개 회귀 없음

---

## 핵심 설계 결정

| 결정 | 이유 |
|------|------|
| 임베딩 벡터를 XCom 대신 tmpfile로 전달 | 1024차원 × 최대 수백 건 → XCom DB 크기 제한 초과 위험 |
| `run_id` 기반 tmp 파일명 (`re.sub` sanitize) | 같은 날짜 재실행 시 파일 충돌 방지 |
| `find_new_submissions`에서 두 Variable 조기 검증 | `SEUNG_DATABASE_URL` 없이 임베딩까지 진행하면 비용 낭비 후 `mark_processed`에서 실패 |
| `processed_ids` = 임베딩 시도한 전체 ID (upserted만이 아님) | 이미 RAG DB에 있는 중복 레코드도 `processed=true`로 마킹해야 재처리 방지 |
| `ON CONFLICT DO NOTHING` | 파이프라인 재실행 멱등성 보장 |
