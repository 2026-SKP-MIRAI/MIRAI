"""job_crawl_dag 단위 테스트 — 워크넷 전용"""
import json
from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest


# ── 테스트 1: DAG 스케줄 확인 ────────────────────────────────────────────────

def test_dag_schedule():
    """DAG 스케줄이 매주 일요일 UTC 03:00 (KST 12:00) 인지 확인."""
    import job_crawl_dag
    assert job_crawl_dag.dag.schedule_interval == "0 3 * * 0"


# ── 테스트 2: crawl_list XCom push ───────────────────────────────────────────

def test_crawl_list_xcom_push_s3_key(mock_ti):
    """crawl_list가 list_s3_key를 XCom에 push하는지 검증."""
    from worknet_client import WorknetListItem

    fake_items = [
        WorknetListItem("W001", "기업A", "공고A", "1", "http://a"),
    ]

    _vars = {
        "S3_RAG_BUCKET_NAME": "bucket",
        "WORKNET_API_KEY": "test-key",
        "WORKNET_RATE_LIMIT_SEC": "0.0",
        "AWS_ACCESS_KEY_ID": "k", "AWS_SECRET_ACCESS_KEY": "s", "AWS_REGION": "ap-northeast-2",
    }

    with patch("job_crawl_dag.Variable.get", side_effect=lambda k, **kw: _vars.get(k, kw.get("default_var", ""))), \
         patch("job_crawl_dag.WorknetClient") as MockClient, \
         patch("job_crawl_dag.boto3.client") as s3_mock:
        MockClient.return_value.fetch_all_list.return_value = fake_items
        s3_mock.return_value.put_object = MagicMock()

        from job_crawl_dag import crawl_list
        crawl_list(ds="2026-01-05", ti=mock_ti)

    push_call = mock_ti.xcom_push.call_args
    key = push_call.kwargs.get("key") or push_call[1].get("key")
    value = push_call.kwargs.get("value") or push_call[1].get("value")
    assert key == "list_s3_key"
    assert "job-crawl/" in value
    assert "worknet" in value


# ── 테스트 3: content에 pref_cond 포함 ───────────────────────────────────────

def test_crawl_details_content_includes_pref_cond(mock_ti):
    """content = title + job_content + pref_cond 검증."""
    from worknet_client import WorknetListItem, WorknetDetail

    list_item = WorknetListItem("W001", "기업A", "공고A", "1", "http://a")
    detail = WorknetDetail(
        wanted_auth_no="W001", company="기업A", title="공고A",
        job_cd="1", job_role="IT직", source_url="http://a",
        pref_cond="Python 우대", job_content="API 개발",
        region="서울", sal="5000", career="경력", education="대졸",
    )

    list_jsonl = json.dumps({
        "wanted_auth_no": "W001", "company": "기업A",
        "title": "공고A", "job_cd": "1", "source_url": "http://a",
    }, ensure_ascii=False).encode()

    _vars = {
        "S3_RAG_BUCKET_NAME": "bucket",
        "WORKNET_API_KEY": "test-key",
        "WORKNET_RATE_LIMIT_SEC": "0.0",
        "AWS_ACCESS_KEY_ID": "k", "AWS_SECRET_ACCESS_KEY": "s", "AWS_REGION": "ap-northeast-2",
    }
    mock_ti.xcom_pull.return_value = "job-crawl/2026/01/05/worknet/list.jsonl"

    uploaded_body = {}

    def fake_put(**kwargs):
        uploaded_body["body"] = kwargs["Body"].decode()

    with patch("job_crawl_dag.Variable.get", side_effect=lambda k, **kw: _vars.get(k, kw.get("default_var", ""))), \
         patch("job_crawl_dag.WorknetClient") as MockClient, \
         patch("job_crawl_dag.boto3.client") as s3_mock:
        MockClient.return_value.fetch_details_batch.return_value = [detail]
        s3_mock.return_value.get_object.return_value = {"Body": BytesIO(list_jsonl)}
        s3_mock.return_value.put_object = MagicMock(side_effect=fake_put)

        from job_crawl_dag import crawl_details
        crawl_details(ds="2026-01-05", ti=mock_ti)

    record = json.loads(uploaded_body["body"])
    assert "Python 우대" in record["content"]
    assert "API 개발" in record["content"]


# ── 테스트 4: embed_postings 배치 처리 ───────────────────────────────────────

def test_embed_postings_batches_100(mock_ti):
    """250건 → 3배치(100+100+50) 엔진 호출 검증."""
    records = [
        {"job_role": "IT직", "title": f"T{i}", "company": "Co",
         "content": f"내용{i}", "source_url": f"http://x/{i}",
         "pref_cond": "", "job_cd": "1"}
        for i in range(250)
    ]
    raw_body = "\n".join(json.dumps(r, ensure_ascii=False) for r in records).encode()
    mock_ti.xcom_pull.return_value = "job-crawl/2026/01/05/worknet/details.jsonl"

    _vars = {
        "S3_RAG_BUCKET_NAME": "bucket", "ENGINE_BASE_URL": "http://engine",
        "AWS_ACCESS_KEY_ID": "k", "AWS_SECRET_ACCESS_KEY": "s", "AWS_REGION": "ap-northeast-2",
    }
    with patch("job_crawl_dag.Variable.get", side_effect=lambda k, **kw: _vars.get(k, kw.get("default_var", ""))), \
         patch("job_crawl_dag.boto3.client") as s3_mock, \
         patch("job_crawl_dag.requests.post") as post_mock:
        s3_mock.return_value.get_object.return_value = {"Body": BytesIO(raw_body)}
        s3_mock.return_value.put_object = MagicMock()
        post_mock.return_value.raise_for_status = MagicMock()
        post_mock.return_value.json.return_value = {"embeddings": [[0.1] * 1024] * 100}

        from job_crawl_dag import embed_postings
        embed_postings(ds="2026-01-05", ti=mock_ti)

    assert post_mock.call_count == 3


# ── 테스트 5: upsert ON CONFLICT + pref_cond 컬럼 ────────────────────────────

def test_upsert_vectors_includes_pref_cond(mock_ti):
    """INSERT SQL에 pref_cond, job_cd 컬럼 및 ON CONFLICT 포함 검증."""
    record = {
        "job_role": "IT직", "title": "공고", "company": "기업",
        "content": "내용", "source_url": "http://x/1",
        "pref_cond": "Python 우대", "job_cd": "1",
        "embedding": [0.1] * 1024,
    }
    embedded_body = json.dumps(record, ensure_ascii=False).encode()
    mock_ti.xcom_pull.return_value = "job-crawl/2026/01/05/worknet/embedded.jsonl"

    _vars = {
        "S3_RAG_BUCKET_NAME": "bucket", "RAG_POSTGRES_CONN_ID": "postgresql://localhost/test",
        "AWS_ACCESS_KEY_ID": "k", "AWS_SECRET_ACCESS_KEY": "s", "AWS_REGION": "ap-northeast-2",
    }
    with patch("job_crawl_dag.Variable.get", side_effect=lambda k, **kw: _vars.get(k, kw.get("default_var", ""))), \
         patch("job_crawl_dag.boto3.client") as s3_mock, \
         patch("job_crawl_dag.psycopg2.connect") as conn_mock, \
         patch("job_crawl_dag.psycopg2.extras.execute_values") as ev_mock:
        s3_mock.return_value.get_object.return_value = {"Body": BytesIO(embedded_body)}
        cur = MagicMock()
        cur.__enter__ = MagicMock(return_value=cur)
        cur.__exit__ = MagicMock(return_value=False)
        conn_mock.return_value.cursor.return_value = cur

        from job_crawl_dag import upsert_vectors
        upsert_vectors(ds="2026-01-05", ti=mock_ti)

    # execute_values 호출됐는지, SQL에 pref_cond/job_cd/ON CONFLICT 포함됐는지 검증
    ev_mock.assert_called_once()
    called_sql = ev_mock.call_args[0][1]
    assert "pref_cond" in called_sql
    assert "job_cd" in called_sql
    assert "ON CONFLICT" in called_sql
    assert "DO UPDATE" in called_sql
    conn_mock.return_value.commit.assert_called_once()
