# feat: [seung][DE] 합격 자소서 임베딩 자동화 파이프라인

## 사용자 관점 목표

새로운 합격 자소서 데이터가 추가될 때마다 자동으로 임베딩되어 서류 진단 RAG 품질이 지속적으로 향상된다.

## 배경

#294 (seed 데이터 초기 적재)로 RAG가 활성화된 이후, 새로운 합격 자소서 데이터가 추가될 때마다 수동으로 `build_resume_index.py`를 실행하는 건 비효율적이다. Airflow DAG로 자동화하여 데이터가 추가되면 자동으로 임베딩 및 적재가 이루어지도록 한다.

> **선행 조건**: #294 (합격 자소서 seed 데이터 수집 및 초기 적재) 완료 후 진행.

## 완료 기준

- [x] Airflow DAG: `find_new_submissions → embed_batch → upsert_vectors → mark_processed`
- [x] 미처리 데이터(`processed=false`)만 배치 처리 — 기존 데이터 재처리 없음
- [x] 배치 단위 임베딩 (100개, engine `/api/embed` rate limit 준수)
- [x] `RAG_DATABASE_URL` 미설정 시 DAG graceful skip
- [x] 테스트: `embed_batch` 로직, 중복 upsert 방지 검증

## 개발 체크리스트
- [x] 테스트 코드 포함 (8개, 12/12 통과)
- [x] 해당 디렉토리 `.ai.md` 최신화
- [x] 불변식 위반 없음 (RAG 실패 시 기존 서류 진단 동작 유지)

---

## 작업 내역

### 구현 배경 조정

초기 계획(`accepted_resumes.json` processed 플래그 관리)은 해당 파일이 `.gitignore`에 포함되어 있어 플래그 상태가 재실행마다 리셋되는 문제가 있었다. 데이터 소스를 `ResumeSubmission` DB 테이블(#301에서 생성)로 변경하여 DB를 단일 진실 소스로 사용하도록 재설계했다.

### 신규 파일

**`services/seung/airflow/dags/seung_resume_embed_dag.py`**
- 4단계 파이프라인: `find_new_submissions >> embed_batch >> upsert_vectors >> mark_processed`
- `find_new_submissions`: `RAG_DATABASE_URL`·`SEUNG_DATABASE_URL` 조기 검증 후 `ResumeSubmission WHERE processed=false` 조회. 레코드 없으면 `AirflowSkipException` graceful skip.
- `embed_batch`: seung DB에서 레코드 재조회(XCom 크기 제한으로 ID만 전달) → 100개 배치로 엔진 `/api/embed` 호출. 실패 시 1회 재시도, 배치 단위 스킵. 결과를 `run_id` 기반 임시 JSONL 파일로 저장(같은 날 재실행 충돌 방지).
- `upsert_vectors`: JSONL 읽어 RAG DB `accepted_resume_embeddings` 테이블에 `ON CONFLICT DO NOTHING` upsert. 멱등성 보장.
- `mark_processed`: `ResumeSubmission SET processed=true WHERE id = ANY(...)` 업데이트 후 임시 파일 정리.

**`services/seung/airflow/tests/test_seung_resume_embed_dag.py`**
- 8개 단위 테스트, 12/12 통과. skip 전파, 배치 분할, 중복 upsert, DB UPDATE 호출 등 주요 경로 커버.

### 수정 파일

**`services/seung/airflow/.ai.md`**
- 두 번째 DAG 추가로 SQLite 기술부채 트리거 조건 충족 기록 (두 DAG 스케줄 비겹침으로 즉시 전환 불필요 판단).
- 아키텍처 불변식 4 예외: 읽기(`seung_db_readonly`)·쓰기(`SEUNG_DATABASE_URL`) 분리 명시.
- Variables/Connections 섹션을 DAG별로 분리.

**`services/seung/airflow/docker-compose.yml`**
- `AIRFLOW_VAR_RAG_DATABASE_URL`, `AIRFLOW_VAR_SEUNG_DATABASE_URL` 환경변수 추가.

**`services/seung/airflow/requirements.txt`**
- `requests>=2.28.0,<3.0.0` 추가 (embed_batch HTTP 호출용).

