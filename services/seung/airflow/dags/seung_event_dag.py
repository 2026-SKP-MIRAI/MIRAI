"""
seung_event_dag: 유저 행동 이벤트 수집·집계 DAG

Schedule: 매일 UTC 17:00 (KST 02:00) — analytics_dag(15:00), resume_embed_dag(16:00)와 겹치지 않음
Catchup: False
Pipeline: collect_events >> aggregate_funnel >> load_to_s3 >> alert_on_high_dropout

기술부채:
- collect_events: list_objects_v2는 최대 1000개 반환 (pagination 미구현)
- aggregate_funnel: XCom으로 이벤트 전체 전달 (이벤트 증가 시 Airflow metadata DB 부담)
"""
from __future__ import annotations

import json
import logging
import uuid
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


def collect_events(ds: str, **kwargs):
    from airflow.exceptions import AirflowSkipException

    try:
        bucket = Variable.get("SEUNG_S3_EVENTS_BUCKET")
    except KeyError:
        raise AirflowSkipException("SEUNG_S3_EVENTS_BUCKET Variable이 설정되지 않았습니다.")

    date_path = ds.replace("-", "/")
    prefix = f"events/{date_path}/"

    # IAM Instance Role로 자격증명 자동 주입 — explicit credential 불필요
    s3 = boto3.client("s3")

    # 기술부채: list_objects_v2는 최대 1000개 반환 — pagination 미구현
    response = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)
    if response.get("IsTruncated"):
        logger.warning(f"[collect_events] S3 result truncated for {ds} — 1000건 초과, 일부 이벤트 누락. pagination 구현 필요.")
    contents = response.get("Contents", [])

    events = []
    for obj in contents:
        body = s3.get_object(Bucket=bucket, Key=obj["Key"])["Body"].read().decode("utf-8")
        try:
            events.append(json.loads(body))
        except (json.JSONDecodeError, ValueError):
            logger.warning(f"이벤트 파싱 실패: {obj['Key']}")

    kwargs["ti"].xcom_push(key="events", value=events)
    logger.info(f"Collected {len(events)} events for {ds} from s3://{bucket}/{prefix}")


def aggregate_funnel(ds: str, **kwargs):
    from airflow.exceptions import AirflowSkipException

    events = kwargs["ti"].xcom_pull(key="events", task_ids="collect_events")
    if events is None:
        raise AirflowSkipException("collect_events가 skip되었거나 events가 없습니다.")

    # 파생 이벤트 제거 — DAG 재실행 시 이전 run이 적재한 session_abandoned 중복 집계 방지
    events = [e for e in events if e.get("event_type") != "session_abandoned"]

    # 이벤트 타입별 분류
    by_type: dict[str, list[dict]] = {}
    for event in events:
        et = event.get("event_type", "unknown")
        by_type.setdefault(et, []).append(event)

    started = by_type.get("session_started", [])
    answered = by_type.get("answer_submitted", [])
    generated = by_type.get("report_generated", [])
    viewed = by_type.get("report_viewed", [])

    # 고유 session_id 기준 집계
    started_sessions = {e["session_id"] for e in started if "session_id" in e}
    answered_sessions = {e["session_id"] for e in answered if "session_id" in e}
    generated_sessions = {e["session_id"] for e in generated if "session_id" in e}
    viewed_sessions = {e["session_id"] for e in viewed if "session_id" in e}

    total_started = len(started_sessions)
    total_answered = len(answered_sessions)
    total_generated = len(generated_sessions)
    total_viewed = len(viewed_sessions)
    # session_started 후 report_generated 없는 세션 = 이탈
    abandoned_session_ids = started_sessions - generated_sessions
    abandoned_count = len(abandoned_session_ids)

    # session_id → user_id 매핑 (session_abandoned 이벤트 생성에 사용)
    session_to_user: dict[str, str] = {}
    for e in started:
        sid = e.get("session_id")
        uid = e.get("user_id")
        if sid and uid:
            session_to_user[sid] = uid

    # session_abandoned 이벤트 생성 — load_to_s3에서 S3 Raw Zone 적재
    abandoned_events = [
        {
            "event_type": "session_abandoned",
            "user_id": session_to_user.get(sid, "unknown"),
            "session_id": sid,
            "timestamp": f"{ds}T23:59:59.000Z",
            "properties": {},
        }
        for sid in abandoned_session_ids
    ]
    kwargs["ti"].xcom_push(key="abandoned_events", value=abandoned_events)

    start_to_report_rate = total_generated / total_started if total_started > 0 else 0.0
    report_to_view_rate = total_viewed / total_generated if total_generated > 0 else 0.0

    # 세션별 최대 question_index + 1 = 답변 수
    answer_counts: dict[str, int] = {}
    for e in answered:
        sid = e.get("session_id")
        qi = e.get("properties", {}).get("question_index", 0)
        if sid:
            answer_counts[sid] = max(answer_counts.get(sid, 0), qi + 1)
    avg_answers_per_session = (
        sum(answer_counts.values()) / len(answer_counts) if answer_counts else None
    )

    answer_lengths = [
        e.get("properties", {}).get("answer_length")
        for e in answered
        if e.get("properties", {}).get("answer_length") is not None
    ]
    avg_answer_length = sum(answer_lengths) / len(answer_lengths) if answer_lengths else None

    funnel = {
        "date": ds,
        "session_started": total_started,
        "answer_submitted_sessions": total_answered,
        "report_generated": total_generated,
        "report_viewed": total_viewed,
        "abandoned_count": abandoned_count,
        "start_to_report_rate": round(start_to_report_rate, 4),
        "report_to_view_rate": round(report_to_view_rate, 4),
        "avg_answers_per_session": round(avg_answers_per_session, 2) if avg_answers_per_session is not None else None,
        "avg_answer_length": round(avg_answer_length, 1) if avg_answer_length is not None else None,
    }

    kwargs["ti"].xcom_push(key="funnel", value=funnel)
    logger.info(f"Aggregated funnel for {ds}: {funnel}")


def load_to_s3(ds: str, **kwargs):
    from airflow.exceptions import AirflowSkipException

    funnel = kwargs["ti"].xcom_pull(key="funnel", task_ids="aggregate_funnel")
    if not funnel:
        raise AirflowSkipException("aggregate_funnel이 skip되었거나 funnel이 없습니다.")

    try:
        bucket = Variable.get("SEUNG_S3_EVENTS_BUCKET")
    except KeyError:
        raise AirflowSkipException("SEUNG_S3_EVENTS_BUCKET Variable이 설정되지 않았습니다.")

    s3_key = f"events/processed/{ds}/funnel.json"
    # IAM Instance Role로 자격증명 자동 주입 — explicit credential 불필요
    s3 = boto3.client("s3")
    s3.put_object(
        Bucket=bucket,
        Key=s3_key,
        Body=json.dumps(funnel, ensure_ascii=False).encode("utf-8"),
    )
    logger.info(f"Loaded funnel for {ds} to s3://{bucket}/{s3_key}")

    # session_abandoned 이벤트 S3 Raw Zone 적재
    abandoned_events = kwargs["ti"].xcom_pull(key="abandoned_events", task_ids="aggregate_funnel") or []
    date_path = ds.replace("-", "/")
    for event in abandoned_events:
        event_key = f"events/{date_path}/{uuid.uuid4()}.json"
        s3.put_object(
            Bucket=bucket,
            Key=event_key,
            Body=json.dumps(event, ensure_ascii=False).encode("utf-8"),
        )
    if abandoned_events:
        logger.info(f"Wrote {len(abandoned_events)} session_abandoned events for {ds} to s3://{bucket}/events/{date_path}/")


def alert_on_high_dropout(ds: str, **kwargs):
    funnel = kwargs["ti"].xcom_pull(key="funnel", task_ids="aggregate_funnel")
    if not funnel:
        return
    if funnel.get("start_to_report_rate", 1.0) < 0.2:
        logger.warning(
            f"[ALERT] High dropout rate on {ds}: "
            f"start_to_report_rate={funnel['start_to_report_rate']:.2%} "
            f"(session_started={funnel.get('session_started')}, "
            f"abandoned_count={funnel.get('abandoned_count')})"
        )


with DAG(
    dag_id="seung_event_dag",
    default_args=default_args,
    schedule="0 17 * * *",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["mirai", "seung", "events"],
) as dag:
    t1 = PythonOperator(task_id="collect_events", python_callable=collect_events)
    t2 = PythonOperator(task_id="aggregate_funnel", python_callable=aggregate_funnel)
    t3 = PythonOperator(task_id="load_to_s3", python_callable=load_to_s3)
    t4 = PythonOperator(task_id="alert_on_high_dropout", python_callable=alert_on_high_dropout)
    t1 >> t2 >> t3 >> t4
