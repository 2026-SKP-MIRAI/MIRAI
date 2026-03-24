"""
seung_analytics_dag: 면접 세션 일별 집계 DAG

Schedule: 매일 UTC 15:00 (KST 00:00)
Catchup: False
Pipeline: extract_sessions >> compute_metrics >> load_to_s3 >> alert_on_low_completion
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta

import boto3

from airflow import DAG
from airflow.models import Variable
from airflow.operators.python import PythonOperator

logger = logging.getLogger(__name__)

default_args = {
    "owner": "mirai-de",
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}


def extract_sessions(ds: str, **kwargs):
    import psycopg2
    from airflow.exceptions import AirflowSkipException
    from airflow.hooks.base import BaseHook

    try:
        bucket = Variable.get("SEUNG_S3_ANALYTICS_BUCKET")
    except KeyError:
        raise AirflowSkipException("SEUNG_S3_ANALYTICS_BUCKET Variable이 설정되지 않았습니다.")

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
                """
                SELECT
                    s.id,
                    s."sessionComplete",
                    s."interviewMode",
                    s.history,
                    s."createdAt",
                    r.id        AS report_id,
                    r."totalScore"
                FROM "InterviewSession" s
                LEFT JOIN "Report" r ON r."sessionId" = s.id
                WHERE DATE(s."createdAt" AT TIME ZONE 'Asia/Seoul') = %s
                """,
                (ds,),
            )
            columns = [desc[0] for desc in cur.description]
            rows = [dict(zip(columns, row)) for row in cur.fetchall()]
    finally:
        conn.close()

    # Convert non-serializable types (datetime, etc.) to string
    def _serialize(obj):
        if hasattr(obj, "isoformat"):
            return obj.isoformat()
        return str(obj)

    lines = [json.dumps(row, default=_serialize, ensure_ascii=False) for row in rows]
    body = "\n".join(lines)

    date_path = ds.replace("-", "/")
    s3_key = f"seung/{date_path}/sessions_raw.jsonl"

    # IAM Instance Role로 자격증명 자동 주입 — explicit credential 불필요
    s3 = boto3.client("s3")
    s3.put_object(Bucket=bucket, Key=s3_key, Body=body.encode("utf-8"))

    kwargs["ti"].xcom_push(key="raw_s3_key", value=s3_key)
    logger.info(f"Extracted {len(rows)} sessions for {ds}, uploaded to s3://{bucket}/{s3_key}")


def compute_metrics(ds: str, **kwargs):
    from airflow.exceptions import AirflowSkipException

    raw_s3_key = kwargs["ti"].xcom_pull(key="raw_s3_key", task_ids="extract_sessions")

    # extract_sessions가 skip된 경우 None이 반환됨 → skip 전파
    if not raw_s3_key:
        raise AirflowSkipException("extract_sessions가 skip되었거나 raw_s3_key가 없습니다.")

    try:
        bucket = Variable.get("SEUNG_S3_ANALYTICS_BUCKET")
    except KeyError:
        raise AirflowSkipException("SEUNG_S3_ANALYTICS_BUCKET Variable이 설정되지 않았습니다.")

    # IAM Instance Role로 자격증명 자동 주입 — explicit credential 불필요
    s3 = boto3.client("s3")
    body = s3.get_object(Bucket=bucket, Key=raw_s3_key)["Body"].read().decode("utf-8")
    sessions = [json.loads(line) for line in body.strip().split("\n") if line.strip()]

    total_sessions = len(sessions)
    complete_sessions = [s for s in sessions if s.get("sessionComplete") is True]
    sessions_with_report = [s for s in sessions if s.get("report_id") is not None]

    # completion_rate
    completion_rate = len(complete_sessions) / total_sessions if total_sessions > 0 else 0.0

    # report_rate = Report 있는 세션 / 전체 세션
    # (report/generate는 sessionComplete 체크 없이 리포트 생성 가능하므로 분모를 전체 세션으로 사용)
    report_rate = len(sessions_with_report) / total_sessions if total_sessions > 0 else 0.0

    # avg_total_score
    scores = [
        s["totalScore"]
        for s in sessions_with_report
        if s.get("totalScore") is not None
    ]
    avg_total_score = sum(scores) / len(scores) if scores else None

    # mode_distribution
    mode_distribution: dict[str, int] = {}
    for s in sessions:
        mode = s.get("interviewMode", "unknown")
        mode_distribution[mode] = mode_distribution.get(mode, 0) + 1

    # avg_dropout_history_len — sessionComplete=false 세션의 history 길이 평균
    dropout_sessions = [s for s in sessions if s.get("sessionComplete") is not True]
    dropout_history_lens = []
    for s in dropout_sessions:
        history = s.get("history")
        if isinstance(history, list):
            dropout_history_lens.append(len(history))
        elif isinstance(history, str):
            try:
                parsed = json.loads(history)
                if isinstance(parsed, list):
                    dropout_history_lens.append(len(parsed))
            except (json.JSONDecodeError, TypeError):
                pass
    avg_dropout_history_len = (
        sum(dropout_history_lens) / len(dropout_history_lens)
        if dropout_history_lens
        else None
    )

    metrics = {
        "date": ds,
        "total_sessions": total_sessions,
        "completion_rate": round(completion_rate, 4),
        "report_rate": round(report_rate, 4),
        "avg_total_score": round(avg_total_score, 2) if avg_total_score is not None else None,
        "mode_distribution": mode_distribution,
        "avg_dropout_history_len": (
            round(avg_dropout_history_len, 2) if avg_dropout_history_len is not None else None
        ),
    }

    kwargs["ti"].xcom_push(key="metrics", value=metrics)
    logger.info(f"Computed metrics for {ds}: {metrics}")


def load_to_s3(ds: str, **kwargs):
    from airflow.exceptions import AirflowSkipException

    metrics = kwargs["ti"].xcom_pull(key="metrics", task_ids="compute_metrics")

    # compute_metrics가 skip된 경우 None 반환 → skip 전파 (S3에 null 적재 방지)
    if not metrics:
        raise AirflowSkipException("compute_metrics가 skip되었거나 metrics가 없습니다.")

    try:
        bucket = Variable.get("SEUNG_S3_ANALYTICS_BUCKET")
    except KeyError:
        raise AirflowSkipException("SEUNG_S3_ANALYTICS_BUCKET Variable이 설정되지 않았습니다.")

    s3_key = f"seung/processed/{ds}/metrics.json"
    # IAM Instance Role로 자격증명 자동 주입 — explicit credential 불필요
    s3 = boto3.client("s3")
    s3.put_object(
        Bucket=bucket,
        Key=s3_key,
        Body=json.dumps(metrics, ensure_ascii=False).encode("utf-8"),
    )
    logger.info(f"Loaded metrics for {ds} to s3://{bucket}/{s3_key}")


def alert_on_low_completion(ds: str, **kwargs):
    metrics = kwargs["ti"].xcom_pull(key="metrics", task_ids="compute_metrics")
    if not metrics:
        return
    if metrics.get("completion_rate", 1.0) < 0.3:
        logger.warning(
            f"[ALERT] Low completion rate on {ds}: "
            f"completion_rate={metrics['completion_rate']:.2%} "
            f"(total_sessions={metrics.get('total_sessions')})"
        )


with DAG(
    dag_id="seung_analytics_dag",
    default_args=default_args,
    schedule="0 15 * * *",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["mirai", "seung", "analytics"],
) as dag:
    t1 = PythonOperator(task_id="extract_sessions", python_callable=extract_sessions)
    t2 = PythonOperator(task_id="compute_metrics", python_callable=compute_metrics)
    t3 = PythonOperator(task_id="load_to_s3", python_callable=load_to_s3)
    t4 = PythonOperator(task_id="alert_on_low_completion", python_callable=alert_on_low_completion)
    t1 >> t2 >> t3 >> t4
