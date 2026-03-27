"""
seung_resume_embed_dag: 사용자 제출 합격 자소서 임베딩 파이프라인

Schedule: 매일 KST 01:00 (UTC 16:00)
Catchup: False
Pipeline: find_new_submissions >> embed_batch >> upsert_vectors >> mark_processed

데이터 소스: seung DB ResumeSubmission 테이블 (processed=false, #301)
데이터 싱크: RAG DB accepted_resume_embeddings 테이블

필요 Airflow Variables:
  RAG_DATABASE_URL   - pgvector Supabase 연결 문자열 (미설정 시 graceful skip)
  SEUNG_DATABASE_URL - seung DB 쓰기 연결 문자열 (mark_processed 전용)
  ENGINE_BASE_URL    - 엔진 URL (기본값: http://localhost:8000)

필요 Airflow Connections:
  seung_db_readonly  - seung DB 읽기 전용 (find_new_submissions, embed_batch)
"""
from __future__ import annotations

import json
import logging
import os
import re
import tempfile
import time
from datetime import datetime, timedelta

from airflow import DAG
from airflow.models import Variable
from airflow.operators.python import PythonOperator

logger = logging.getLogger(__name__)

BATCH_SIZE = 100
EMBED_MODEL = "baai/bge-m3"
EMBED_TIMEOUT = 60

default_args = {
    "owner": "mirai-de",
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}


def find_new_submissions(**kwargs):
    import psycopg2
    from airflow.exceptions import AirflowSkipException
    from airflow.hooks.base import BaseHook

    try:
        Variable.get("RAG_DATABASE_URL")
    except KeyError:
        raise AirflowSkipException("RAG_DATABASE_URL Variable이 설정되지 않았습니다.")

    try:
        Variable.get("SEUNG_DATABASE_URL")
    except KeyError:
        raise AirflowSkipException("SEUNG_DATABASE_URL Variable이 설정되지 않았습니다.")

    conn_info = BaseHook.get_connection("seung_db_readonly")
    conn = psycopg2.connect(
        host=conn_info.host,
        port=conn_info.port or 5432,
        dbname=conn_info.schema,
        user=conn_info.login,
        password=conn_info.password,
    )
    try:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT id FROM "ResumeSubmission" WHERE processed = false'
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    if not rows:
        raise AirflowSkipException("처리할 신규 제출이 없습니다.")

    submission_ids = [row[0] for row in rows]
    kwargs["ti"].xcom_push(key="submission_ids", value=submission_ids)
    logger.info("[find] 미처리 제출: %d건", len(submission_ids))


def embed_batch(ds: str, **kwargs):
    import psycopg2
    import requests
    from airflow.exceptions import AirflowSkipException
    from airflow.hooks.base import BaseHook

    submission_ids = kwargs["ti"].xcom_pull(
        key="submission_ids", task_ids="find_new_submissions"
    )
    if not submission_ids:
        raise AirflowSkipException(
            "find_new_submissions가 skip되었거나 submission_ids가 없습니다."
        )

    engine_url = Variable.get("ENGINE_BASE_URL", default_var="http://localhost:8000")

    # seung DB에서 전체 레코드 조회
    conn_info = BaseHook.get_connection("seung_db_readonly")
    conn = psycopg2.connect(
        host=conn_info.host,
        port=conn_info.port or 5432,
        dbname=conn_info.schema,
        user=conn_info.login,
        password=conn_info.password,
    )
    try:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT id, "jobRole", content, company FROM "ResumeSubmission"'
                " WHERE id = ANY(%s)",
                (submission_ids,),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    submissions = [
        {"id": r[0], "jobRole": r[1], "content": r[2], "company": r[3] or ""}
        for r in rows
    ]

    results = []
    total = len(submissions)
    batch_count = (total + BATCH_SIZE - 1) // BATCH_SIZE

    for batch_idx in range(batch_count):
        batch = submissions[batch_idx * BATCH_SIZE : (batch_idx + 1) * BATCH_SIZE]
        texts = [s["content"] for s in batch]

        embeddings = None
        for attempt in range(2):
            try:
                resp = requests.post(
                    f"{engine_url.rstrip('/')}/api/embed",
                    json={"texts": texts, "model": EMBED_MODEL},
                    timeout=EMBED_TIMEOUT,
                )
                resp.raise_for_status()
                embeddings = resp.json().get("embeddings", [])
                break
            except Exception as e:
                if attempt == 0:
                    logger.warning("[embed] 배치 %d 실패, 재시도: %s", batch_idx + 1, e)
                    time.sleep(1)
                else:
                    logger.warning("[embed] 배치 %d 건너뜀: %s", batch_idx + 1, e)

        if embeddings is None:
            continue

        if len(embeddings) != len(batch):
            logger.warning(
                "[embed] 배치 %d 임베딩 수 불일치: 요청 %d건, 반환 %d건",
                batch_idx + 1, len(batch), len(embeddings),
            )
        for s, emb in zip(batch, embeddings):
            results.append(
                {
                    "id": s["id"],
                    "jobRole": s["jobRole"],
                    "content": s["content"],
                    "company": s["company"],
                    "embedding": emb,
                }
            )
        time.sleep(0.1)

    # run_id 기반 파일명 — 같은 날짜 재실행 시 충돌 방지
    run_id = kwargs.get("run_id", ds)
    safe_run_id = re.sub(r"[^\w\-]", "_", run_id)
    tmp_path = os.path.join(tempfile.gettempdir(), f"resume_embed_{safe_run_id}.jsonl")
    with open(tmp_path, "w", encoding="utf-8") as f:
        for r in results:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    kwargs["ti"].xcom_push(key="embed_tmp_path", value=tmp_path)
    logger.info("[embed] %d/%d건 임베딩 완료 → %s", len(results), total, tmp_path)


def upsert_vectors(**kwargs):
    import psycopg2
    from psycopg2.extras import execute_values
    from airflow.exceptions import AirflowSkipException

    embed_tmp_path = kwargs["ti"].xcom_pull(
        key="embed_tmp_path", task_ids="embed_batch"
    )
    if not embed_tmp_path:
        raise AirflowSkipException(
            "embed_batch가 skip되었거나 embed_tmp_path가 없습니다."
        )

    try:
        rag_db_url = Variable.get("RAG_DATABASE_URL")
    except KeyError:
        raise AirflowSkipException("RAG_DATABASE_URL Variable이 설정되지 않았습니다.")

    with open(embed_tmp_path, encoding="utf-8") as f:
        records_data = [json.loads(line) for line in f if line.strip()]

    if not records_data:
        logger.info("[upsert] 처리할 레코드 없음")
        return

    conn = psycopg2.connect(rag_db_url)
    try:
        sql = """
            INSERT INTO accepted_resume_embeddings (job_role, content, embedding, source)
            VALUES %s
            ON CONFLICT DO NOTHING
        """
        template = "(%s, %s, %s::vector, %s)"
        records = [
            (
                r["jobRole"],
                r["content"],
                json.dumps(r["embedding"]),
                r["company"],
            )
            for r in records_data
        ]
        with conn.cursor() as cur:
            execute_values(cur, sql, records, template=template)
            conn.commit()
            upserted = cur.rowcount if cur.rowcount >= 0 else len(records)
    finally:
        conn.close()

    role_counts: dict[str, int] = {}
    for r in records_data:
        role = r["jobRole"]
        role_counts[role] = role_counts.get(role, 0) + 1
    logger.info("[upsert] %d건 적재. 직군별: %s", upserted, role_counts)

    kwargs["ti"].xcom_push(key="upserted_count", value=upserted)
    kwargs["ti"].xcom_push(
        key="processed_ids", value=[r["id"] for r in records_data]
    )


def mark_processed(**kwargs):
    import psycopg2
    from airflow.exceptions import AirflowSkipException

    upserted_count = kwargs["ti"].xcom_pull(
        key="upserted_count", task_ids="upsert_vectors"
    )
    if upserted_count is None:
        return

    processed_ids = kwargs["ti"].xcom_pull(
        key="processed_ids", task_ids="upsert_vectors"
    )
    if not processed_ids:
        return

    try:
        seung_db_url = Variable.get("SEUNG_DATABASE_URL")
    except KeyError:
        raise AirflowSkipException("SEUNG_DATABASE_URL Variable이 설정되지 않았습니다.")

    conn = psycopg2.connect(seung_db_url)
    try:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE "ResumeSubmission" SET processed = true WHERE id = ANY(%s)',
                (processed_ids,),
            )
            conn.commit()
            logger.info("[mark] %d건 processed=true 설정 완료", cur.rowcount)
    finally:
        conn.close()

    # 임시 파일 정리
    embed_tmp_path = kwargs["ti"].xcom_pull(
        key="embed_tmp_path", task_ids="embed_batch"
    )
    if embed_tmp_path and os.path.exists(embed_tmp_path):
        try:
            os.remove(embed_tmp_path)
        except OSError:
            pass


with DAG(
    dag_id="seung_resume_embed_dag",
    default_args=default_args,
    schedule="0 16 * * *",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["mirai", "seung", "rag", "embedding"],
) as dag:
    t1 = PythonOperator(
        task_id="find_new_submissions", python_callable=find_new_submissions
    )
    t2 = PythonOperator(task_id="embed_batch", python_callable=embed_batch)
    t3 = PythonOperator(task_id="upsert_vectors", python_callable=upsert_vectors)
    t4 = PythonOperator(task_id="mark_processed", python_callable=mark_processed)
    t1 >> t2 >> t3 >> t4
