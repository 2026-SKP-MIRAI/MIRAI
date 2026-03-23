"""job_crawl_dag 단위 테스트"""
import json
import time
from io import BytesIO
from unittest.mock import MagicMock, patch, call

import pytest


# ── 테스트 1 ─────────────────────────────────────────────────────────────────

def test_crawl_respects_robots_txt(mock_ti):
    """robots.txt가 비허용하는 URL은 크롤링 스킵 → 빈 파일 S3 업로드."""
    from job_crawl_dag import crawl_jobkorea

    rp_mock = MagicMock()
    rp_mock.can_fetch.return_value = False  # 모든 경로 비허용

    with patch("job_crawl_dag._get_robot_parser", return_value=rp_mock), \
         patch("job_crawl_dag.Variable.get", return_value="test-bucket"), \
         patch("job_crawl_dag.boto3.client") as mock_s3, \
         patch("job_crawl_dag.requests.Session"):
        mock_s3.return_value.put_object = MagicMock()
        crawl_jobkorea(ds="2026-01-05", ti=mock_ti)

    # 모두 차단 → 빈 postings → 빈 body로 S3 업로드 (downstream XCom key 보장)
    put_call = mock_s3.return_value.put_object.call_args
    assert put_call is not None
    body = put_call.kwargs.get("Body", b"")
    assert body.strip() == b""
    # XCom에 s3_key 전달됨
    mock_ti.xcom_push.assert_called_once_with(key="raw_s3_key", value="job-crawl/2026/01/05/raw.jsonl")


# ── 테스트 2 ─────────────────────────────────────────────────────────────────

def test_crawl_rate_limit(mock_ti):
    """요청 간 RATE_LIMIT_SEC 이상 sleep 호출 검증."""
    from job_crawl_dag import RATE_LIMIT_SEC

    sleep_calls = []

    with patch("job_crawl_dag.time.sleep", side_effect=lambda s: sleep_calls.append(s)), \
         patch("job_crawl_dag._get_robot_parser") as rp, \
         patch("job_crawl_dag.Variable.get", return_value="bucket"), \
         patch("job_crawl_dag.boto3.client"), \
         patch("job_crawl_dag.requests.Session") as sess:
        rp.return_value.can_fetch.return_value = True
        sess.return_value.get.return_value.status_code = 200
        sess.return_value.get.return_value.raise_for_status = lambda: None
        from job_crawl_dag import crawl_jobkorea
        crawl_jobkorea(ds="2026-01-05", ti=mock_ti)

    assert all(s >= RATE_LIMIT_SEC for s in sleep_calls)
    assert len(sleep_calls) > 0


# ── 테스트 3 ─────────────────────────────────────────────────────────────────

def test_embed_postings_batches_100(mock_ti):
    """250건 공고를 100건씩 3배치로 분할하여 embed 호출 검증."""
    postings = [
        {"job_role": "백엔드", "title": f"T{i}", "company": "Co", "content": f"내용{i}", "source_url": f"http://x/{i}"}
        for i in range(250)
    ]
    raw_body = "\n".join(json.dumps(p, ensure_ascii=False) for p in postings).encode()

    mock_ti.xcom_pull.return_value = "job-crawl/2026/01/05/raw.jsonl"

    _vars = {"S3_RAG_BUCKET_NAME": "bucket", "ENGINE_BASE_URL": "http://engine", "AWS_ACCESS_KEY_ID": "test", "AWS_SECRET_ACCESS_KEY": "test", "AWS_REGION": "ap-northeast-2"}
    with patch("job_crawl_dag.Variable.get", side_effect=lambda k, **kw: _vars.get(k, kw.get("default_var", ""))), \
         patch("job_crawl_dag.boto3.client") as s3_mock, \
         patch("job_crawl_dag.requests.post") as post_mock:
        s3_mock.return_value.get_object.return_value = {"Body": BytesIO(raw_body)}
        s3_mock.return_value.put_object = MagicMock()
        post_mock.return_value.raise_for_status = lambda: None
        post_mock.return_value.json.return_value = {"embeddings": [[0.1] * 1024] * 100}

        from job_crawl_dag import embed_postings
        embed_postings(ds="2026-01-05", ti=mock_ti)

    assert post_mock.call_count == 3  # ceil(250/100) = 3


# ── 테스트 4 ─────────────────────────────────────────────────────────────────

def test_upsert_vectors_conflict_update(mock_ti):
    """ON CONFLICT 포함 SQL 실행 검증."""
    record = {
        "job_role": "백엔드", "title": "Title", "company": "Co",
        "content": "내용", "source_url": "http://x/1",
        "embedding": [0.1] * 1024,
    }
    embedded_body = json.dumps(record, ensure_ascii=False).encode()
    mock_ti.xcom_pull.return_value = "job-crawl/2026/01/05/embedded.jsonl"

    _vars = {"S3_RAG_BUCKET_NAME": "bucket", "RAG_POSTGRES_CONN_ID": "postgresql://localhost/test", "AWS_ACCESS_KEY_ID": "test", "AWS_SECRET_ACCESS_KEY": "test", "AWS_REGION": "ap-northeast-2"}
    with patch("job_crawl_dag.Variable.get", side_effect=lambda k, **kw: _vars.get(k, kw.get("default_var", ""))), \
         patch("job_crawl_dag.boto3.client") as s3_mock, \
         patch("job_crawl_dag.psycopg2.connect") as conn_mock:
        s3_mock.return_value.get_object.return_value = {"Body": BytesIO(embedded_body)}
        cur_mock = MagicMock()
        cur_mock.__enter__ = MagicMock(return_value=cur_mock)
        cur_mock.__exit__ = MagicMock(return_value=False)
        conn_mock.return_value.cursor.return_value = cur_mock

        from job_crawl_dag import upsert_vectors
        upsert_vectors(ds="2026-01-05", ti=mock_ti)

    executed_sql = cur_mock.execute.call_args[0][0]
    assert "ON CONFLICT" in executed_sql
    assert "DO UPDATE" in executed_sql


# ── 테스트 5 ─────────────────────────────────────────────────────────────────

def test_xcom_contains_s3_key_only(mock_ti):
    """XCom push 값이 S3 key 문자열이어야 함 (대용량 텍스트 아님)."""
    with patch("job_crawl_dag._get_robot_parser") as rp, \
         patch("job_crawl_dag.Variable.get", return_value="bucket"), \
         patch("job_crawl_dag.boto3.client"), \
         patch("job_crawl_dag.requests.Session") as sess:
        rp.return_value.can_fetch.return_value = True
        sess.return_value.get.return_value.raise_for_status = lambda: None
        from job_crawl_dag import crawl_jobkorea
        crawl_jobkorea(ds="2026-01-05", ti=mock_ti)

    push_call = mock_ti.xcom_push.call_args
    pushed_value = push_call.kwargs.get("value", push_call[1].get("value", ""))
    # S3 key는 짧은 문자열이어야 함 (대용량 JSON 아님)
    assert isinstance(pushed_value, str)
    assert len(pushed_value) < 200
    assert "job-crawl/" in pushed_value
