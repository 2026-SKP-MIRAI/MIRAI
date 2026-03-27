# [#293] feat: [seung][DE] 합격 자소서 임베딩 자동화 파이프라인 — 구현 계획

> 작성: 2026-03-27

---

## 완료 기준

- [x] Airflow DAG: `find_new_submissions → embed_batch → upsert_vectors → mark_processed`
- [x] 미처리 데이터(`processed=false`)만 배치 처리 — 기존 데이터 재처리 없음
- [x] 배치 단위 임베딩 (100개, engine `/api/embed` rate limit 준수)
- [x] `RAG_DATABASE_URL` 미설정 시 DAG graceful skip
- [x] 테스트: `embed_batch` 로직, 중복 upsert 방지 검증
- [x] 테스트 코드 포함 (8개, 12/12 통과)
- [x] 해당 디렉토리 `.ai.md` 최신화
- [x] 불변식 위반 없음 (RAG 실패 시 기존 서류 진단 동작 유지)

---

## 구현 계획

### 사전 파악 사항

- **데이터 소스**: `resume_submissions` 테이블 (seung DB) — #301에서 생성, DAG는 readonly 접근
  - 스키마: `id, userId, jobRole, content, company, processed(bool), createdAt`
  - `processed=false` 레코드만 처리 대상
- **데이터 싱크**: `accepted_resume_embeddings` 테이블 (RAG DB, `RAG_DATABASE_URL`)
- `build_resume_index.py`의 `embed_batch`, `upsert_batch` 로직 재활용
- 기존 `seung_analytics_dag.py` 패턴 동일하게 따름 (Airflow Variable, AirflowSkipException, seung DB readonly 접근)
- **XCom 크기 제한**: 임베딩 벡터(1024차원)는 XCom 직접 저장 불가 → 임시 파일 경로만 전달
- `resume_submissions` 테이블은 seung 서비스 소유(불변식 #4) — DAG는 `seung_db_readonly` 커넥션으로만 접근
- DAG 추가로 SQLite 메타DB 기술부채 트리거 조건 충족 → `.ai.md`에 기록

---

### Step 1 — DAG 작성

**파일**: `services/seung/airflow/dags/seung_resume_embed_dag.py`

**스케줄**: `0 16 * * *` (KST 01:00, 매일 1회)

**필요 Airflow Variables**:

| Variable | 설명 | 미설정 시 |
|---|---|---|
| `RAG_DATABASE_URL` | pgvector Supabase 연결 문자열 | `find_new_submissions`에서 graceful skip |
| `ENGINE_BASE_URL` | 엔진 URL | 기본값 `http://localhost:8000` |

**DB 연결**:
- seung DB: `seung_db_readonly` Airflow Connection (기존 analytics DAG와 동일)
- RAG DB: `RAG_DATABASE_URL` Airflow Variable

**태스크별 설계**:

#### `find_new_submissions`
```
- RAG_DATABASE_URL 미설정 → AirflowSkipException
- seung DB 쿼리: SELECT id, jobRole, content, company FROM "ResumeSubmission" WHERE processed = false
- 결과 없으면 AirflowSkipException("처리할 신규 제출 없음")
- 제출 id 목록 XCom push (key="submission_ids")
- logger.info("[find] 미처리 제출: {n}건")
```

#### `embed_batch`
```
- submission_ids가 None → AirflowSkipException 전파
- seung DB에서 해당 레코드 재조회
- 100개 배치로 엔진 POST /api/embed 호출
- 결과를 /tmp/resume_embed_{run_id}.jsonl에 저장
  형식: {"id": N, "jobRole": "...", "content": "...", "company": "...", "embedding": [...]}
- 임시 파일 경로 XCom push (key="embed_tmp_path")
- 실패 배치는 1회 재시도 후 건너뜀 (build_resume_index.py 방식 동일)
```

#### `upsert_vectors`
```
- embed_tmp_path 없으면 AirflowSkipException 전파
- 임시 파일 JSONL 읽기
- RAG DB accepted_resume_embeddings 테이블에 ON CONFLICT DO NOTHING upsert
  (build_resume_index.py의 upsert_batch 동일 SQL 사용)
- 삽입 건수 XCom push (key="upserted_count")
- 직군별 커버리지 로깅
```

#### `mark_processed`
```
- upserted_count 없으면 조기 return
- seung DB: UPDATE "ResumeSubmission" SET processed = true WHERE id IN (submission_ids)
- logger.info("[mark] {n}건 processed=true 설정 완료")
```

> `mark_processed`는 seung DB 쓰기 필요 → `seung_db_readonly` 대신 별도 write 커넥션 사용
> 또는 Airflow Variable로 write용 DB URL 별도 관리

**파이프라인**:
```
find_new_submissions >> embed_batch >> upsert_vectors >> mark_processed
```

---

### Step 2 — 테스트 작성

**파일**: `services/seung/airflow/tests/test_seung_resume_embed_dag.py`

기존 `conftest.py` mock 패턴 재활용 (airflow 모듈 mock, `mock_ti` fixture).

| # | 테스트명 | 검증 내용 |
|---|---|---|
| 1 | `test_find_new_submissions_skip_no_db_url` | `RAG_DATABASE_URL` 미설정 → `AirflowSkipException` |
| 1-2 | `test_find_new_submissions_skip_no_seung_db_url` | `SEUNG_DATABASE_URL` 미설정 → `AirflowSkipException` (임베딩 비용 낭비 방지) |
| 2 | `test_find_new_submissions_skip_no_records` | `processed=false` 레코드 없음 → `AirflowSkipException` |
| 3 | `test_find_new_submissions_returns_ids` | `processed=false` 2건 → XCom에 id 목록 push |
| 4 | `test_embed_batch_calls_engine_in_batches` | 250건 → 엔진 3회 호출 (100+100+50), 임시 파일 생성 |
| 5 | `test_embed_batch_skip_propagation` | `submission_ids=None` → `AirflowSkipException` |
| 6 | `test_upsert_vectors_no_duplicate` | `ON CONFLICT DO NOTHING` — rowcount=0 시 upserted_count=0 push |
| 7 | `test_mark_processed_updates_db` | `mark_processed` 실행 후 DB UPDATE 호출 확인 |

---

### Step 3 — `.ai.md` 업데이트

**`services/seung/airflow/.ai.md`**:
- 구조에 `seung_resume_embed_dag.py` 추가
- SQLite 기술부채: 두 번째 DAG 추가로 트리거 조건 충족 기록
- `mark_processed` write 커넥션 방식 명시

---

### 변경 파일 목록

```
services/seung/airflow/dags/seung_resume_embed_dag.py        # 신규
services/seung/airflow/tests/test_seung_resume_embed_dag.py  # 신규
services/seung/airflow/.ai.md                                # 업데이트
docs/work/active/000293-resume-embedding-pipeline/00_issue.md  # 작업 내역 추가
```

---

### 주의사항

- XCom에 임베딩 벡터 직접 저장 금지 — 임시 파일 경로만 저장
- `resume_submissions` 테이블은 seung 서비스 소유 — DAG가 직접 생성하지 않음
- `mark_processed`는 write 권한 필요 — readonly 커넥션과 분리
- 불변식 #2 준수: 임베딩 호출은 반드시 엔진 `/api/embed` 경유
- `upsert_vectors`는 `ON CONFLICT DO NOTHING` — 재실행 멱등성 보장
- #301 Prisma 마이그레이션 전까지 통합 테스트는 수동 DB 세팅 필요
