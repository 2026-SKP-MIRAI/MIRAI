"""seung_resume_embed_dag 단위 테스트"""
import json
import os
import sys
import tempfile
from unittest.mock import MagicMock, patch, call

import pytest

# psycopg2.extras와 requests 추가 mock (conftest의 psycopg2 mock 확장)
_psycopg2_extras = MagicMock()
sys.modules["psycopg2.extras"] = _psycopg2_extras
sys.modules["requests"] = MagicMock()

from seung_resume_embed_dag import (  # noqa: E402
    find_new_submissions,
    embed_batch,
    upsert_vectors,
    mark_processed,
)

AirflowSkipException = sys.modules["airflow.exceptions"].AirflowSkipException


def _xcom_pushes(mock_ti):
    """xcom_push 호출 목록을 {key: value} dict로 반환."""
    result = {}
    for c in mock_ti.xcom_push.call_args_list:
        key = c.kwargs["key"] if "key" in c.kwargs else (c.args[0] if c.args else None)
        value = c.kwargs["value"] if "value" in c.kwargs else (c.args[1] if len(c.args) > 1 else None)
        if key is not None:
            result[key] = value
    return result


def _make_db_conn(rows):
    """psycopg2 연결 mock — cursor.fetchall()이 rows를 반환."""
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = rows
    mock_cursor.rowcount = len(rows)
    mock_conn = MagicMock()
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    return mock_conn, mock_cursor


# ── 테스트 1 ──────────────────────────────────────────────────────────────────

def test_find_new_submissions_skip_no_db_url(mock_ti):
    """RAG_DATABASE_URL 미설정 → AirflowSkipException"""
    with patch(
        "seung_resume_embed_dag.Variable.get", side_effect=KeyError("RAG_DATABASE_URL")
    ):
        with pytest.raises(AirflowSkipException):
            find_new_submissions(ti=mock_ti)


# ── 테스트 1-2 ────────────────────────────────────────────────────────────────

def test_find_new_submissions_skip_no_seung_db_url(mock_ti):
    """SEUNG_DATABASE_URL 미설정 → AirflowSkipException (임베딩 비용 낭비 방지)"""
    def _raise_for_seung(key, **kw):
        if key == "SEUNG_DATABASE_URL":
            raise KeyError(key)
        return "postgresql://test"

    with patch("seung_resume_embed_dag.Variable.get", side_effect=_raise_for_seung):
        with pytest.raises(AirflowSkipException):
            find_new_submissions(ti=mock_ti)


# ── 테스트 2 ──────────────────────────────────────────────────────────────────

def test_find_new_submissions_skip_no_records(mock_ti):
    """processed=false 레코드 없음 → AirflowSkipException"""
    mock_conn, _ = _make_db_conn(rows=[])

    with patch("seung_resume_embed_dag.Variable.get", return_value="postgresql://test"):
        with patch("psycopg2.connect", return_value=mock_conn):
            with pytest.raises(AirflowSkipException):
                find_new_submissions(ti=mock_ti)


# ── 테스트 3 ──────────────────────────────────────────────────────────────────

def test_find_new_submissions_returns_ids(mock_ti):
    """processed=false 2건 → submission_ids=[1, 2] XCom push"""
    mock_conn, _ = _make_db_conn(rows=[(1,), (2,)])

    with patch("seung_resume_embed_dag.Variable.get", return_value="postgresql://test"):
        with patch("psycopg2.connect", return_value=mock_conn):
            find_new_submissions(ti=mock_ti)

    pushes = _xcom_pushes(mock_ti)
    assert pushes["submission_ids"] == [1, 2]


# ── 테스트 4 ──────────────────────────────────────────────────────────────────

def test_embed_batch_calls_engine_in_batches(mock_ti):
    """250건 → 엔진 3회 호출 (100+100+50), 임시 파일 생성"""
    submission_ids = list(range(1, 251))
    db_rows = [(i, "IT/개발", f"자소서 내용 {i}", "회사") for i in range(1, 251)]
    mock_conn, _ = _make_db_conn(rows=db_rows)

    mock_resp = MagicMock()
    mock_resp.json.return_value = {"embeddings": [[0.1, 0.2]] * 100}
    mock_resp.raise_for_status.return_value = None

    def _xcom_pull_side_effect(key, task_ids):
        if key == "submission_ids":
            return submission_ids
        return None

    mock_ti.xcom_pull.side_effect = _xcom_pull_side_effect

    with patch("seung_resume_embed_dag.Variable.get", return_value="http://localhost:8000"):
        with patch("psycopg2.connect", return_value=mock_conn):
            with patch("requests.post", return_value=mock_resp) as mock_post:
                with patch("time.sleep"):
                    embed_batch(ds="2026-03-27", ti=mock_ti)

    assert mock_post.call_count == 3

    pushes = _xcom_pushes(mock_ti)
    assert "embed_tmp_path" in pushes

    # 임시 파일 정리
    tmp_path = pushes["embed_tmp_path"]
    if os.path.exists(tmp_path):
        os.remove(tmp_path)


# ── 테스트 5 ──────────────────────────────────────────────────────────────────

def test_embed_batch_skip_propagation(mock_ti):
    """submission_ids=None → AirflowSkipException"""
    mock_ti.xcom_pull.return_value = None

    with patch(
        "seung_resume_embed_dag.Variable.get", return_value="http://localhost:8000"
    ):
        with pytest.raises(AirflowSkipException):
            embed_batch(ds="2026-03-27", ti=mock_ti)


# ── 테스트 6 ──────────────────────────────────────────────────────────────────

def test_upsert_vectors_no_duplicate(mock_ti):
    """rowcount=0 (ON CONFLICT DO NOTHING 전체 중복) → upserted_count=0 push"""
    record = {
        "id": 1,
        "jobRole": "IT/개발",
        "content": "합격 자소서 내용",
        "company": "테스트회사",
        "embedding": [0.1, 0.2],
    }

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".jsonl", delete=False, encoding="utf-8"
    ) as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
        tmp_path = f.name

    try:
        mock_conn, mock_cursor = _make_db_conn(rows=[])
        mock_cursor.rowcount = 0  # ON CONFLICT DO NOTHING — 전체 중복

        def _xcom_pull_side_effect(key, task_ids):
            if key == "embed_tmp_path":
                return tmp_path
            return None

        mock_ti.xcom_pull.side_effect = _xcom_pull_side_effect

        _vars = {"RAG_DATABASE_URL": "postgresql://test"}

        with patch(
            "seung_resume_embed_dag.Variable.get",
            side_effect=lambda k, **kw: _vars[k],
        ):
            with patch("psycopg2.connect", return_value=mock_conn):
                upsert_vectors(ti=mock_ti)

        pushes = _xcom_pushes(mock_ti)
        assert pushes["upserted_count"] == 0

        # execute_values SQL에 md5 기반 ON CONFLICT 포함 여부 검증
        execute_values_call = _psycopg2_extras.execute_values.call_args
        sql_arg = execute_values_call.args[1] if execute_values_call.args else ""
        assert "ON CONFLICT ((md5(content))) DO NOTHING" in sql_arg
    finally:
        os.unlink(tmp_path)


# ── 테스트 7 ──────────────────────────────────────────────────────────────────

def test_mark_processed_updates_db(mock_ti):
    """mark_processed 실행 후 DB UPDATE 호출 및 processed_ids 반영 확인"""
    processed_ids = [1, 2, 3]

    def _xcom_pull_side_effect(key, task_ids):
        if key == "upserted_count":
            return 3
        if key == "processed_ids":
            return processed_ids
        if key == "embed_tmp_path":
            return None
        return None

    mock_ti.xcom_pull.side_effect = _xcom_pull_side_effect

    mock_conn, mock_cursor = _make_db_conn(rows=[])

    _vars = {"SEUNG_DATABASE_URL": "postgresql://seung-write"}

    with patch(
        "seung_resume_embed_dag.Variable.get",
        side_effect=lambda k, **kw: _vars[k],
    ):
        with patch("psycopg2.connect", return_value=mock_conn):
            mark_processed(ti=mock_ti)

    # UPDATE SQL 호출 확인
    execute_call = mock_cursor.execute.call_args
    sql = execute_call.args[0] if execute_call.args else ""
    assert "UPDATE" in sql
    assert "ResumeSubmission" in sql
    assert "processed" in sql

    # 전달된 IDs 확인
    params = execute_call.args[1] if len(execute_call.args) > 1 else execute_call.kwargs.get("vars")
    assert processed_ids in params
