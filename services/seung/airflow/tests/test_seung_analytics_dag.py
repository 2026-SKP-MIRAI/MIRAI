"""seung_analytics_dag 단위 테스트"""
import json
from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest


# ── 테스트 1 ─────────────────────────────────────────────────────────────────

def test_compute_metrics_completion_rate(mock_ti):
    """10개 세션 중 4개 sessionComplete=true → completion_rate=0.4"""
    sessions = [
        {"id": str(i), "sessionComplete": (i < 4), "interviewMode": "real",
         "history": [], "report_id": None, "totalScore": None}
        for i in range(10)
    ]
    raw_body = "\n".join(json.dumps(s, ensure_ascii=False) for s in sessions).encode()

    mock_ti.xcom_pull.return_value = "seung/2026/01/05/sessions_raw.jsonl"

    _vars = {
        "SEUNG_S3_ANALYTICS_BUCKET": "test-bucket",
        "AWS_ACCESS_KEY_ID": "test",
        "AWS_SECRET_ACCESS_KEY": "test",
        "AWS_REGION": "ap-northeast-2",
    }

    with patch("seung_analytics_dag.Variable.get", side_effect=lambda k, **kw: _vars.get(k, kw.get("default_var", ""))), \
         patch("seung_analytics_dag.boto3.client") as mock_s3:
        mock_s3.return_value.get_object.return_value = {"Body": BytesIO(raw_body)}

        from seung_analytics_dag import compute_metrics
        compute_metrics(ds="2026-01-05", ti=mock_ti)

    pushed = mock_ti.xcom_push.call_args
    metrics = pushed.kwargs.get("value") or pushed[1].get("value")
    assert metrics["completion_rate"] == 0.4
    assert metrics["total_sessions"] == 10


# ── 테스트 2 ─────────────────────────────────────────────────────────────────

def test_compute_metrics_mode_distribution(mock_ti):
    """real 3개, practice 2개 → mode_distribution={"real":3,"practice":2}"""
    sessions = [
        {"id": "1", "sessionComplete": True, "interviewMode": "real",    "history": [], "report_id": None, "totalScore": None},
        {"id": "2", "sessionComplete": True, "interviewMode": "real",    "history": [], "report_id": None, "totalScore": None},
        {"id": "3", "sessionComplete": True, "interviewMode": "real",    "history": [], "report_id": None, "totalScore": None},
        {"id": "4", "sessionComplete": False, "interviewMode": "practice", "history": [], "report_id": None, "totalScore": None},
        {"id": "5", "sessionComplete": False, "interviewMode": "practice", "history": [], "report_id": None, "totalScore": None},
    ]
    raw_body = "\n".join(json.dumps(s, ensure_ascii=False) for s in sessions).encode()

    mock_ti.xcom_pull.return_value = "seung/2026/01/05/sessions_raw.jsonl"

    _vars = {
        "SEUNG_S3_ANALYTICS_BUCKET": "test-bucket",
        "AWS_ACCESS_KEY_ID": "test",
        "AWS_SECRET_ACCESS_KEY": "test",
        "AWS_REGION": "ap-northeast-2",
    }

    with patch("seung_analytics_dag.Variable.get", side_effect=lambda k, **kw: _vars.get(k, kw.get("default_var", ""))), \
         patch("seung_analytics_dag.boto3.client") as mock_s3:
        mock_s3.return_value.get_object.return_value = {"Body": BytesIO(raw_body)}

        from seung_analytics_dag import compute_metrics
        compute_metrics(ds="2026-01-05", ti=mock_ti)

    pushed = mock_ti.xcom_push.call_args
    metrics = pushed.kwargs.get("value") or pushed[1].get("value")
    assert metrics["mode_distribution"] == {"real": 3, "practice": 2}


# ── 테스트 3 ─────────────────────────────────────────────────────────────────

def test_compute_metrics_empty_data(mock_ti):
    """빈 데이터 → completion_rate=0.0, ZeroDivisionError 없음"""
    raw_body = b""

    mock_ti.xcom_pull.return_value = "seung/2026/01/05/sessions_raw.jsonl"

    _vars = {
        "SEUNG_S3_ANALYTICS_BUCKET": "test-bucket",
        "AWS_ACCESS_KEY_ID": "test",
        "AWS_SECRET_ACCESS_KEY": "test",
        "AWS_REGION": "ap-northeast-2",
    }

    with patch("seung_analytics_dag.Variable.get", side_effect=lambda k, **kw: _vars.get(k, kw.get("default_var", ""))), \
         patch("seung_analytics_dag.boto3.client") as mock_s3:
        mock_s3.return_value.get_object.return_value = {"Body": BytesIO(raw_body)}

        from seung_analytics_dag import compute_metrics
        # ZeroDivisionError 없이 완료되어야 함
        compute_metrics(ds="2026-01-05", ti=mock_ti)

    pushed = mock_ti.xcom_push.call_args
    metrics = pushed.kwargs.get("value") or pushed[1].get("value")
    assert metrics["completion_rate"] == 0.0
    assert metrics["total_sessions"] == 0


# ── 테스트 4 ─────────────────────────────────────────────────────────────────

def test_extract_sessions_skip_when_no_bucket(mock_ti):
    """SEUNG_S3_ANALYTICS_BUCKET Variable 없음 → AirflowSkipException"""
    import sys
    AirflowSkipException = sys.modules["airflow.exceptions"].AirflowSkipException

    def raise_key_error(k, **kw):
        if k == "SEUNG_S3_ANALYTICS_BUCKET":
            raise KeyError(k)
        return "test"

    with patch("seung_analytics_dag.Variable.get", side_effect=raise_key_error):
        from seung_analytics_dag import extract_sessions
        with pytest.raises(AirflowSkipException):
            extract_sessions(ds="2026-01-05", ti=mock_ti)
