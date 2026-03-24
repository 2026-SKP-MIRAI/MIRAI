"""
job_crawl_dag — 워크넷(고용24) 채용공고 수집 + pgvector upsert
스케줄: 매주 일요일 KST 12:00 (UTC 03:00)

파이프라인:
  crawl_list → crawl_details → embed_postings → upsert_vectors → log_summary
"""
import json
import logging
from dataclasses import asdict
from datetime import datetime, timedelta

import boto3
import psycopg2
import psycopg2.extras
import requests
from airflow import DAG
from airflow.models import Variable
from airflow.operators.python import PythonOperator

from worknet_client import WorknetClient

log = logging.getLogger(__name__)

default_args = {
    "owner": "mirai",
    "retries": 1,
    "retry_delay": timedelta(minutes=10),
    "execution_timeout": timedelta(hours=3),
}

dag = DAG(
    dag_id="job_crawl_dag",
    default_args=default_args,
    schedule_interval="0 3 * * 0",   # KST 일요일 12:00
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["mirai", "rag", "worknet"],
)


def _s3():
    return boto3.client(
        "s3",
        aws_access_key_id=Variable.get("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=Variable.get("AWS_SECRET_ACCESS_KEY"),
        region_name=Variable.get("AWS_REGION", default_var="ap-northeast-2"),
    )


def _s3_prefix(ds: str) -> str:
    return f"job-crawl/{ds.replace('-', '/')}/worknet"


# ── Task 1: 목록 수집 ─────────────────────────────────────────────────────────

def crawl_list(ds: str, **context) -> None:
    """워크넷 채용목록 수집 → S3 list.jsonl"""
    bucket = Variable.get("S3_RAG_BUCKET_NAME")
    s3_key = f"{_s3_prefix(ds)}/list.jsonl"

    client = WorknetClient()
    max_pages = int(Variable.get("WORKNET_MAX_PAGES_PER_CODE", default_var="1"))
    items = client.fetch_all_list(max_pages=max_pages)

    body = "\n".join(
        json.dumps(asdict(item), ensure_ascii=False) for item in items
    )
    s3 = _s3()
    s3.put_object(Bucket=bucket, Key=s3_key, Body=body.encode())
    log.info("crawl_list: %d건 → s3://%s/%s", len(items), bucket, s3_key)

    context["ti"].xcom_push(key="list_s3_key", value=s3_key)


# ── Task 2: 상세 조회 (배치) ──────────────────────────────────────────────────

def crawl_details(ds: str, **context) -> None:
    """목록의 wantedAuthNo별 상세 조회 → pref_cond 포함 → S3 details.jsonl"""
    bucket = Variable.get("S3_RAG_BUCKET_NAME")
    list_key = context["ti"].xcom_pull(task_ids="crawl_list", key="list_s3_key")
    if not list_key:
        raise ValueError("crawl_list did not produce list_s3_key")
    details_key = f"{_s3_prefix(ds)}/details.jsonl"

    s3 = _s3()
    obj = s3.get_object(Bucket=bucket, Key=list_key)
    lines = obj["Body"].read().decode().strip().split("\n")

    from worknet_client import WorknetListItem
    items = [WorknetListItem(**json.loads(line)) for line in lines if line.strip()]

    client = WorknetClient()
    details = client.fetch_details_batch(items)

    records = []
    for d in details:
        r = asdict(d)
        # 임베딩 대상 텍스트: 제목 + 직무내용 + 우대사항
        r["content"] = f"{d.title} {d.job_content} {d.pref_cond}".strip()
        records.append(r)

    body = "\n".join(json.dumps(r, ensure_ascii=False) for r in records)
    s3.put_object(Bucket=bucket, Key=details_key, Body=body.encode())
    log.info("crawl_details: %d건 → s3://%s/%s", len(records), bucket, details_key)

    context["ti"].xcom_push(key="details_s3_key", value=details_key)


# ── Task 3: 임베딩 ────────────────────────────────────────────────────────────

def embed_postings(ds: str, **context) -> None:
    """details.jsonl → 엔진 /api/embed 배치 호출 → embedded.jsonl → S3"""
    bucket = Variable.get("S3_RAG_BUCKET_NAME")
    engine_url = Variable.get("ENGINE_BASE_URL")
    details_key = context["ti"].xcom_pull(task_ids="crawl_details", key="details_s3_key")
    if not details_key:
        raise ValueError("crawl_details did not produce details_s3_key")
    embedded_key = f"{_s3_prefix(ds)}/embedded.jsonl"

    s3 = _s3()
    obj = s3.get_object(Bucket=bucket, Key=details_key)
    records = [json.loads(l) for l in obj["Body"].read().decode().strip().split("\n") if l.strip()]

    embedded = []
    for i in range(0, len(records), 100):
        batch = records[i:i + 100]
        resp = requests.post(
            f"{engine_url}/api/embed",
            json={"texts": [r["content"] for r in batch], "model": "baai/bge-m3"},
            timeout=60,
        )
        resp.raise_for_status()
        vectors = resp.json()["embeddings"]
        for record, vec in zip(batch, vectors):
            embedded.append({**record, "embedding": vec})
        log.info("임베딩: %d / %d", len(embedded), len(records))

    body = "\n".join(json.dumps(e, ensure_ascii=False) for e in embedded)
    s3.put_object(Bucket=bucket, Key=embedded_key, Body=body.encode())
    log.info("embed_postings: %d건 → s3://%s/%s", len(embedded), bucket, embedded_key)

    context["ti"].xcom_push(key="embedded_s3_key", value=embedded_key)


# ── Task 4: pgvector upsert ───────────────────────────────────────────────────

def upsert_vectors(ds: str, **context) -> None:
    """embedded.jsonl → pgvector INSERT ON CONFLICT"""
    bucket = Variable.get("S3_RAG_BUCKET_NAME")
    pg_conn_str = Variable.get("RAG_POSTGRES_CONN_ID")
    embedded_key = context["ti"].xcom_pull(task_ids="embed_postings", key="embedded_s3_key")
    if not embedded_key:
        raise ValueError("embed_postings did not produce embedded_s3_key")

    s3 = _s3()
    obj = s3.get_object(Bucket=bucket, Key=embedded_key)
    records = [json.loads(l) for l in obj["Body"].read().decode().strip().split("\n") if l.strip()]

    conn = psycopg2.connect(pg_conn_str)
    try:
        with conn.cursor() as cur:
            rows = [
                (
                    r.get("job_role", ""),
                    r["title"],
                    r["company"],
                    r["content"],
                    "[" + ",".join(str(v) for v in r["embedding"]) + "]",
                    r["source_url"],
                    r.get("pref_cond", ""),
                    r.get("job_cd", ""),
                )
                for r in records
            ]
            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO job_posting_embeddings
                  (job_role, title, company, content, embedding, source_url, pref_cond, job_cd)
                VALUES %s
                ON CONFLICT (source_url, job_role) DO UPDATE SET
                  title      = EXCLUDED.title,
                  company    = EXCLUDED.company,
                  content    = EXCLUDED.content,
                  embedding  = EXCLUDED.embedding::vector,
                  pref_cond  = EXCLUDED.pref_cond,
                  job_cd     = EXCLUDED.job_cd,
                  crawled_at = now()
                """,
                rows,
                template="(%s, %s, %s, %s, %s::vector, %s, %s, %s)",
            )
        conn.commit()
        log.info("upsert_vectors: %d건 완료", len(records))
    finally:
        conn.close()

    context["ti"].xcom_push(key="upserted_count", value=len(records))


# ── Task 5: 요약 로그 ─────────────────────────────────────────────────────────

def log_summary(**context) -> None:
    count = context["ti"].xcom_pull(task_ids="upsert_vectors", key="upserted_count") or 0
    log.info("job_crawl_dag 완료. upserted=%d건", count)


# ── DAG 연결 ──────────────────────────────────────────────────────────────────

t1 = PythonOperator(task_id="crawl_list",    python_callable=crawl_list,    dag=dag)
t2 = PythonOperator(task_id="crawl_details", python_callable=crawl_details, dag=dag)
t3 = PythonOperator(task_id="embed_postings",python_callable=embed_postings, dag=dag)
t4 = PythonOperator(task_id="upsert_vectors",python_callable=upsert_vectors, dag=dag)
t5 = PythonOperator(task_id="log_summary",   python_callable=log_summary,   dag=dag)

t1 >> t2 >> t3 >> t4 >> t5
