"""seung_event_dag 단위 테스트"""
import json
from unittest.mock import MagicMock, patch

import pytest


# ── 테스트 1 ─────────────────────────────────────────────────────────────────

def test_aggregate_funnel_basic(mock_ti):
    """session_started 10, report_generated 3 → start_to_report_rate=0.3, abandoned_count=7"""
    events = (
        [{"event_type": "session_started", "session_id": f"s{i}", "user_id": "u1", "timestamp": "t", "properties": {}} for i in range(10)]
        + [{"event_type": "answer_submitted", "session_id": f"s{i}", "user_id": "u1", "timestamp": "t", "properties": {"question_index": 2, "answer_length": 100, "session_complete": False}} for i in range(8)]
        + [{"event_type": "report_generated", "session_id": f"s{i}", "user_id": "u1", "timestamp": "t", "properties": {"report_id": f"r{i}", "total_score": 70}} for i in range(3)]
    )
    mock_ti.xcom_pull.return_value = events

    from seung_event_dag import aggregate_funnel
    aggregate_funnel(ds="2026-01-05", ti=mock_ti)

    pushed = mock_ti.xcom_push.call_args
    funnel = pushed.kwargs.get("value") or pushed[1].get("value")
    assert funnel["session_started"] == 10
    assert funnel["report_generated"] == 3
    assert funnel["start_to_report_rate"] == 0.3
    assert funnel["abandoned_count"] == 7


# ── 테스트 2 ─────────────────────────────────────────────────────────────────

def test_aggregate_funnel_empty(mock_ti):
    """이벤트 없을 때 → 모든 count=0, rate=0.0"""
    mock_ti.xcom_pull.return_value = []

    from seung_event_dag import aggregate_funnel
    aggregate_funnel(ds="2026-01-05", ti=mock_ti)

    pushed = mock_ti.xcom_push.call_args
    funnel = pushed.kwargs.get("value") or pushed[1].get("value")
    assert funnel["session_started"] == 0
    assert funnel["report_generated"] == 0
    assert funnel["start_to_report_rate"] == 0.0
    assert funnel["abandoned_count"] == 0
    assert funnel["avg_answers_per_session"] is None


# ── 테스트 3 ─────────────────────────────────────────────────────────────────

def test_collect_events_skip_when_no_bucket(mock_ti):
    """SEUNG_S3_EVENTS_BUCKET Variable 미설정 → AirflowSkipException"""
    from airflow.exceptions import AirflowSkipException

    with patch("seung_event_dag.Variable.get", side_effect=KeyError("SEUNG_S3_EVENTS_BUCKET")):
        from seung_event_dag import collect_events
        with pytest.raises(AirflowSkipException):
            collect_events(ds="2026-01-05", ti=mock_ti)


# ── 테스트 4 ─────────────────────────────────────────────────────────────────

def test_alert_on_high_dropout_triggered(mock_ti, caplog):
    """start_to_report_rate=0.1 → warning 로그 발생"""
    import logging
    mock_ti.xcom_pull.return_value = {
        "date": "2026-01-05",
        "session_started": 10,
        "report_generated": 1,
        "start_to_report_rate": 0.1,
        "abandoned_count": 9,
    }

    from seung_event_dag import alert_on_high_dropout
    with caplog.at_level(logging.WARNING):
        alert_on_high_dropout(ds="2026-01-05", ti=mock_ti)

    assert any("ALERT" in r.message for r in caplog.records)


# ── 테스트 5 ─────────────────────────────────────────────────────────────────

def test_alert_on_high_dropout_not_triggered(mock_ti, caplog):
    """start_to_report_rate=0.5 → warning 없음"""
    import logging
    mock_ti.xcom_pull.return_value = {
        "date": "2026-01-05",
        "session_started": 10,
        "report_generated": 5,
        "start_to_report_rate": 0.5,
        "abandoned_count": 5,
    }

    from seung_event_dag import alert_on_high_dropout
    with caplog.at_level(logging.WARNING):
        alert_on_high_dropout(ds="2026-01-05", ti=mock_ti)

    assert not any("ALERT" in r.message for r in caplog.records)


# ── 테스트 6 ─────────────────────────────────────────────────────────────────

def test_aggregate_funnel_avg_answer_length(mock_ti):
    """answer_length 평균 계산 검증"""
    events = [
        {"event_type": "session_started", "session_id": "s1", "user_id": "u1", "timestamp": "t", "properties": {}},
        {"event_type": "answer_submitted", "session_id": "s1", "user_id": "u1", "timestamp": "t", "properties": {"question_index": 0, "answer_length": 100, "session_complete": False}},
        {"event_type": "answer_submitted", "session_id": "s1", "user_id": "u1", "timestamp": "t", "properties": {"question_index": 1, "answer_length": 200, "session_complete": False}},
    ]
    mock_ti.xcom_pull.return_value = events

    from seung_event_dag import aggregate_funnel
    aggregate_funnel(ds="2026-01-05", ti=mock_ti)

    pushed = mock_ti.xcom_push.call_args
    funnel = pushed.kwargs.get("value") or pushed[1].get("value")
    assert funnel["avg_answer_length"] == 150.0


# ── 테스트 7 ─────────────────────────────────────────────────────────────────

def test_aggregate_funnel_abandoned_events(mock_ti):
    """session_started 3, report_generated 1 → abandoned_events 2개, user_id 매핑 정확"""
    events = [
        {"event_type": "session_started", "session_id": "s1", "user_id": "user-a", "timestamp": "t", "properties": {}},
        {"event_type": "session_started", "session_id": "s2", "user_id": "user-b", "timestamp": "t", "properties": {}},
        {"event_type": "session_started", "session_id": "s3", "user_id": "user-c", "timestamp": "t", "properties": {}},
        {"event_type": "report_generated", "session_id": "s1", "user_id": "user-a", "timestamp": "t", "properties": {}},
    ]
    mock_ti.xcom_pull.return_value = events

    from seung_event_dag import aggregate_funnel
    aggregate_funnel(ds="2026-01-05", ti=mock_ti)

    # xcom_push가 여러 번 호출됨 — abandoned_events 호출 찾기
    all_calls = mock_ti.xcom_push.call_args_list
    abandoned_call = next(
        (c for c in all_calls if (c.kwargs.get("key") or c[1].get("key")) == "abandoned_events"),
        None,
    )
    assert abandoned_call is not None
    abandoned = abandoned_call.kwargs.get("value") or abandoned_call[1].get("value")
    assert len(abandoned) == 2
    abandoned_sids = {e["session_id"] for e in abandoned}
    assert abandoned_sids == {"s2", "s3"}
    for e in abandoned:
        assert e["event_type"] == "session_abandoned"
        assert e["user_id"] in ("user-b", "user-c")
        assert e["timestamp"] == "2026-01-05T23:59:59.000Z"


# ── 테스트 8 ─────────────────────────────────────────────────────────────────

def test_load_to_s3_writes_abandoned_events(mock_ti):
    """load_to_s3가 abandoned_events를 S3 Raw Zone에 개별 파일로 적재"""
    abandoned_events = [
        {"event_type": "session_abandoned", "user_id": "user-b", "session_id": "s2", "timestamp": "2026-01-05T23:59:59.000Z", "properties": {}},
        {"event_type": "session_abandoned", "user_id": "user-c", "session_id": "s3", "timestamp": "2026-01-05T23:59:59.000Z", "properties": {}},
    ]

    def xcom_pull_side_effect(key, task_ids=None, **kw):
        if key == "funnel":
            return {"date": "2026-01-05", "session_started": 3, "report_generated": 1, "start_to_report_rate": 0.3333}
        if key == "abandoned_events":
            return abandoned_events
        return None

    mock_ti.xcom_pull.side_effect = xcom_pull_side_effect

    _vars = {"SEUNG_S3_EVENTS_BUCKET": "test-bucket"}

    with patch("seung_event_dag.Variable.get", side_effect=lambda k, **kw: _vars[k]), \
         patch("seung_event_dag.boto3.client") as mock_s3_client:
        mock_s3 = MagicMock()
        mock_s3_client.return_value = mock_s3

        from seung_event_dag import load_to_s3
        load_to_s3(ds="2026-01-05", ti=mock_ti)

    # funnel.json 1회 + abandoned 2회 = 총 3회 put_object
    assert mock_s3.put_object.call_count == 3
    # abandoned 이벤트 키가 events/2026/01/05/ prefix로 시작하는지 확인
    abandoned_calls = [
        c for c in mock_s3.put_object.call_args_list
        if c.kwargs.get("Key", "").startswith("events/2026/01/05/")
    ]
    assert len(abandoned_calls) == 2
