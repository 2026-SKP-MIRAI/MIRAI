"""seung_news_dag 단위 테스트 — 중복 제거 및 증분 처리 로직 검증"""
import sys
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

import seung_news_dag  # noqa: E402


# ---------------------------------------------------------------------------
# 헬퍼
# ---------------------------------------------------------------------------

def _make_article(url: str, title: str = "제목", published_at: str | None = None):
    return {
        "url": url,
        "title": title,
        "summary": None,
        "publishedAt": published_at or datetime.now(tz=timezone.utc).isoformat(),
    }


def _xcom_pushed_value(mock_ti) -> dict:
    """mock_ti.xcom_push로 전달된 value를 추출한다."""
    call_kwargs = mock_ti.xcom_push.call_args
    return call_kwargs[1].get("value") or call_kwargs[0][1]


# ---------------------------------------------------------------------------
# deduplicate 로직 검증
# ---------------------------------------------------------------------------

class TestDeduplicate:
    def test_removes_duplicate_urls(self, mock_ti):
        articles = {
            "IT/개발": [
                _make_article("https://example.com/1"),
                _make_article("https://example.com/1"),  # 중복
                _make_article("https://example.com/2"),
            ]
        }
        mock_ti.xcom_pull.return_value = articles

        seung_news_dag.deduplicate(ti=mock_ti)

        assert mock_ti.xcom_push.called
        result = _xcom_pushed_value(mock_ti)
        assert len(result["IT/개발"]) == 2

    def test_removes_cross_role_duplicates(self, mock_ti):
        """같은 URL이 다른 role에 등장해도 두 번째는 제거된다."""
        articles = {
            "IT/개발": [_make_article("https://example.com/shared")],
            "금융": [_make_article("https://example.com/shared")],
        }
        mock_ti.xcom_pull.return_value = articles

        seung_news_dag.deduplicate(ti=mock_ti)

        result = _xcom_pushed_value(mock_ti)
        total = sum(len(v) for v in result.values())
        assert total == 1

    def test_skips_when_no_articles(self, mock_ti):
        from airflow.exceptions import AirflowSkipException
        mock_ti.xcom_pull.return_value = None

        with pytest.raises(AirflowSkipException):
            seung_news_dag.deduplicate(ti=mock_ti)


# ---------------------------------------------------------------------------
# filter_by_role 로직 검증
# ---------------------------------------------------------------------------

class TestFilterByRole:
    def test_keeps_keyword_matching_articles(self, mock_ti):
        articles = {
            "IT/개발": [
                _make_article("https://a.com/1", title="AI 스타트업 투자 유치"),
                _make_article("https://a.com/2", title="야구 경기 결과"),  # 키워드 없음
            ]
        }
        mock_ti.xcom_pull.return_value = articles

        seung_news_dag.filter_by_role(ti=mock_ti)

        result = _xcom_pushed_value(mock_ti)
        assert len(result.get("IT/개발", [])) == 1
        assert result["IT/개발"][0]["title"] == "AI 스타트업 투자 유치"

    def test_skips_when_no_articles_pass_filter(self, mock_ti):
        from airflow.exceptions import AirflowSkipException
        articles = {"IT/개발": [_make_article("https://a.com/1", title="야구 경기 결과")]}
        mock_ti.xcom_pull.return_value = articles

        with pytest.raises(AirflowSkipException):
            seung_news_dag.filter_by_role(ti=mock_ti)


# ---------------------------------------------------------------------------
# crawl_rss 증분 처리 검증
# ---------------------------------------------------------------------------

class TestCrawlRssIncremental:
    def test_skips_when_no_s3_bucket(self, mock_ti):
        from airflow.exceptions import AirflowSkipException

        with patch("seung_news_dag.Variable.get", side_effect=KeyError("SEUNG_S3_ANALYTICS_BUCKET")):
            with pytest.raises(AirflowSkipException):
                seung_news_dag.crawl_rss(ti=mock_ti)

    def test_filters_old_articles_by_cutoff(self, mock_ti):
        """last_published_at보다 오래된 기사는 수집하지 않는다."""
        cutoff = datetime(2026, 3, 29, 0, 0, 0, tzinfo=timezone.utc)
        old_dt = datetime(2026, 3, 28, tzinfo=timezone.utc)
        new_dt = datetime(2026, 3, 30, tzinfo=timezone.utc)

        # feedparser mock: 오래된 기사 1건 + 신규 기사 1건
        old_entry = MagicMock()
        old_entry.title = "오래된 기사"
        old_entry.link = "https://example.com/old"
        old_entry.summary = ""
        old_entry.published_parsed = old_dt.timetuple()[:6]

        new_entry = MagicMock()
        new_entry.title = "신규 기사"
        new_entry.link = "https://example.com/new"
        new_entry.summary = ""
        new_entry.published_parsed = new_dt.timetuple()[:6]

        mock_feed = MagicMock()
        mock_feed.bozo = False
        mock_feed.entries = [old_entry, new_entry]
        sys.modules["feedparser"].parse.return_value = mock_feed

        import psycopg2
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
        mock_cursor.__exit__ = MagicMock(return_value=False)
        mock_cursor.fetchall.return_value = [("IT/개발", cutoff)]
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)

        with patch("seung_news_dag.Variable.get", return_value="test-bucket"), \
             patch("psycopg2.connect", return_value=mock_conn):
            seung_news_dag.crawl_rss(ti=mock_ti)

        result = _xcom_pushed_value(mock_ti)
        it_articles = result.get("IT/개발", [])
        urls = [a["url"] for a in it_articles]
        assert "https://example.com/old" not in urls
        assert "https://example.com/new" in urls


# ---------------------------------------------------------------------------
# upsert_db 로직 검증
# ---------------------------------------------------------------------------

class TestUpsertDb:
    def test_upsert_calls_execute_values(self, mock_ti):
        """upsert_db가 psycopg2.extras.execute_values로 INSERT를 호출한다."""
        mock_ti.xcom_pull.return_value = {
            "IT/개발": [_make_article("https://example.com/u1", title="기사 1")]
        }
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
        mock_cursor.__exit__ = MagicMock(return_value=False)
        mock_cursor.rowcount = 0
        mock_conn.cursor.return_value = mock_cursor

        with patch("seung_news_dag.Variable.get", return_value="postgresql://test"), \
             patch("psycopg2.connect", return_value=mock_conn):
            seung_news_dag.upsert_db(ti=mock_ti)

        assert sys.modules["psycopg2.extras"].execute_values.called

    def test_upsert_skips_when_no_db_url(self, mock_ti):
        """SEUNG_DATABASE_URL 미설정 시 AirflowSkipException."""
        from airflow.exceptions import AirflowSkipException
        mock_ti.xcom_pull.return_value = {
            "IT/개발": [_make_article("https://example.com/u2")]
        }
        with patch("seung_news_dag.Variable.get", side_effect=KeyError("SEUNG_DATABASE_URL")):
            with pytest.raises(AirflowSkipException):
                seung_news_dag.upsert_db(ti=mock_ti)
