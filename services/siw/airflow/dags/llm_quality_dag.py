"""
llm_quality_dag: 일별 LLM 이벤트 집계 DAG (Phase B — 인프라 안정화 후 활성화)

Schedule: 매일 UTC 15:00 (KST 00:00)
Catchup: False
Pipeline: extract_events >> aggregate_metrics >> load_to_db >> alert_on_high_error_rate
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta

from airflow import DAG
from airflow.models import Variable
from airflow.operators.python import PythonOperator

logger = logging.getLogger(__name__)

default_args = {
    "owner": "mirai-de",
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

def extract_events(ds: str, **kwargs):
    import boto3
    bucket = Variable.get("S3_LOG_BUCKET")
    prefix_base = Variable.get("S3_LOG_PREFIX", default_var="llm-events")
    date_path = ds.replace("-", "/")
    prefix = f"{prefix_base}/{date_path}/"
    s3 = boto3.client("s3")
    paginator = s3.get_paginator("list_objects_v2")
    events = []
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            body = s3.get_object(Bucket=bucket, Key=obj["Key"])["Body"].read().decode()
            for line in body.strip().split("\n"):
                if line:
                    events.append(json.loads(line))
    kwargs["ti"].xcom_push(key="events", value=events)
    logger.info(f"Extracted {len(events)} events for {ds}")

def aggregate_metrics(ds: str, **kwargs):
    events = kwargs["ti"].xcom_pull(key="events", task_ids="extract_events")
    stats: dict[str, dict] = {}
    for e in events:
        ft = e.get("feature_type", "unknown")
        if ft not in stats:
            stats[ft] = {"call_count": 0, "sum_latency_ms": 0, "error_count": 0}
        stats[ft]["call_count"] += 1
        stats[ft]["sum_latency_ms"] += e.get("latency_ms", 0)
        if not e.get("success", True):
            stats[ft]["error_count"] += 1
    result = []
    for ft, s in stats.items():
        cnt = s["call_count"]
        result.append({
            "date": ds,
            "feature_type": ft,
            "call_count": cnt,
            "avg_latency_ms": round(s["sum_latency_ms"] / cnt, 2) if cnt else 0.0,
            "error_count": s["error_count"],
            "error_rate": round(s["error_count"] / cnt, 4) if cnt else 0.0,
        })
    kwargs["ti"].xcom_push(key="metrics", value=result)
    logger.info(f"Aggregated metrics: {result}")

def load_to_db(ds: str, **kwargs):
    import psycopg2
    from airflow.hooks.base import BaseHook
    metrics = kwargs["ti"].xcom_pull(key="metrics", task_ids="aggregate_metrics")
    conn_id = Variable.get("ANALYTICS_DB_CONN", default_var="analytics_db")
    conn_info = BaseHook.get_connection(conn_id)
    conn = psycopg2.connect(
        host=conn_info.host, port=conn_info.port or 5432,
        dbname=conn_info.schema, user=conn_info.login, password=conn_info.password
    )
    try:
        with conn, conn.cursor() as cur:
            for row in metrics:
                cur.execute("""
                    INSERT INTO analytics.llm_events_daily (date, feature_type, call_count, avg_latency_ms, error_count, error_rate, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, now())
                    ON CONFLICT (date, feature_type) DO UPDATE SET
                      call_count = EXCLUDED.call_count,
                      avg_latency_ms = EXCLUDED.avg_latency_ms,
                      error_count = EXCLUDED.error_count,
                      error_rate = EXCLUDED.error_rate,
                      updated_at = now()
                """, (row["date"], row["feature_type"], row["call_count"],
                      row["avg_latency_ms"], row["error_count"], row["error_rate"]))
    finally:
        conn.close()
    logger.info(f"Loaded {len(metrics)} rows for {ds}")

def alert_on_high_error_rate(ds: str, **kwargs):
    metrics = kwargs["ti"].xcom_pull(key="metrics", task_ids="aggregate_metrics")
    for row in metrics:
        if row["error_rate"] > 0.10:
            logger.warning(
                f"[ALERT] High error rate on {ds}: {row['feature_type']} "
                f"error_rate={row['error_rate']:.2%} ({row['error_count']}/{row['call_count']})"
            )

with DAG(
    dag_id="llm_quality_dag",
    default_args=default_args,
    schedule="0 15 * * *",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["mirai", "observability"],
) as dag:
    t1 = PythonOperator(task_id="extract_events", python_callable=extract_events)
    t2 = PythonOperator(task_id="aggregate_metrics", python_callable=aggregate_metrics)
    t3 = PythonOperator(task_id="load_to_db", python_callable=load_to_db)
    t4 = PythonOperator(task_id="alert_on_high_error_rate", python_callable=alert_on_high_error_rate)
    t1 >> t2 >> t3 >> t4
