"""
seung_news_dag: 직군별 업계 뉴스 RSS 수집 파이프라인

Schedule: 매일 KST 09:00 (UTC 00:00)
Catchup: False
Pipeline: crawl_rss >> filter_by_role >> deduplicate >> load_to_s3 >> upsert_db

필요 Airflow Variables:
  SEUNG_S3_ANALYTICS_BUCKET - S3 버킷명 (미설정 시 crawl_rss에서 graceful skip, analytics DAG와 공유)
  SEUNG_DATABASE_URL         - seung DB 쓰기 연결 문자열 (upsert_db 전용)
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

from airflow import DAG
from airflow.models import Variable
from airflow.operators.python import PythonOperator

logger = logging.getLogger(__name__)

MAX_ARTICLES_PER_ROLE = 30

# ⚠️ 아래 URL은 공개 RSS 피드이나 운영 전 실제 응답 여부를 확인할 것
ROLE_FEED_MAP: dict[str, list[str]] = {
    "IT/개발": [
        "https://feeds.feedburner.com/zdnet/",
        "https://www.etnews.com/rss/section005.xml",
    ],
    "마케팅": [
        "https://www.mk.co.kr/rss/30100041/",
    ],
    "금융": [
        "https://www.hankyung.com/feed/finance",
        "https://www.mk.co.kr/rss/30200030/",
    ],
    "의료": [
        "https://www.bosa.co.kr/rss/allArticle.xml",
    ],
    "영업": [
        "https://www.businesspost.co.kr/BP?command=rss",
        "https://www.sedaily.com/RSS/",
    ],
    "회계/재무": [
        "https://www.edaily.co.kr/rss/economy.xml",
        "https://www.hankyung.com/feed/economy",
    ],
    "인사/HR": [
        "https://www.mk.co.kr/rss/30100046/",
        "https://www.econovill.com/rss/allArticle.xml",
    ],
}

ROLE_KEYWORD_MAP: dict[str, list[str]] = {
    "IT/개발": ["AI", "인공지능", "클라우드", "개발자", "스타트업", "반도체", "소프트웨어", "플랫폼", "데이터"],
    "마케팅": ["마케팅", "광고", "브랜드", "캠페인", "콘텐츠", "SNS", "디지털마케팅"],
    "금융": ["금융", "은행", "투자", "주식", "펀드", "금리", "증권", "핀테크"],
    "의료": ["의료", "병원", "헬스케어", "제약", "바이오", "의사", "간호"],
    "영업": ["영업", "세일즈", "매출", "거래처", "B2B", "유통"],
    "회계/재무": ["회계", "재무", "세무", "결산", "감사", "원가", "예산", "CFO", "재무제표"],
    "인사/HR": ["인사", "채용", "HR", "조직문화", "노무", "복지", "인재", "직원", "근로"],
}

FEED_TIMEOUT = 10  # feedparser 요청 타임아웃(초)

default_args = {
    "owner": "mirai-de",
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}


def _parse_published_at(entry) -> datetime:
    """feedparser entry에서 publishedAt 추출. 없으면 현재 UTC 시각 반환."""
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        try:
            return datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
        except Exception:
            pass
    return datetime.now(tz=timezone.utc)


def crawl_rss(**kwargs):
    """RSS 피드 수집. SEUNG_S3_ANALYTICS_BUCKET 미설정 시 graceful skip."""
    import feedparser
    import psycopg2
    from airflow.exceptions import AirflowSkipException

    try:
        Variable.get("SEUNG_S3_ANALYTICS_BUCKET")
    except KeyError:
        raise AirflowSkipException("SEUNG_S3_ANALYTICS_BUCKET Variable이 설정되지 않았습니다.")

    # role별 last_published_at 조회 (증분 처리 기준)
    last_published: dict[str, datetime] = {}
    try:
        seung_db_url = Variable.get("SEUNG_DATABASE_URL")
        conn = psycopg2.connect(seung_db_url)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    'SELECT role, MAX("publishedAt") FROM "NewsArticle" GROUP BY role'
                )
                for role, max_dt in cur.fetchall():
                    if max_dt:
                        last_published[role] = max_dt.replace(tzinfo=timezone.utc) if max_dt.tzinfo is None else max_dt
        finally:
            conn.close()
    except KeyError:
        logger.info("[crawl] SEUNG_DATABASE_URL 미설정 — 전체 기사 수집")
    except Exception as e:
        logger.warning("[crawl] last_published_at 조회 실패, 전체 수집: %s", e)

    articles: dict[str, list[dict]] = {role: [] for role in ROLE_FEED_MAP}

    for role, feed_urls in ROLE_FEED_MAP.items():
        cutoff = last_published.get(role)
        for url in feed_urls:
            try:
                feed = feedparser.parse(url, request_headers={"User-Agent": "MirAI-RSS-Crawler/1.0"}, timeout=FEED_TIMEOUT)
                if feed.bozo:
                    logger.warning("[crawl] bozo feed (비표준 RSS): %s — 파싱 가능 entry는 처리", url)
                for entry in feed.entries:
                    published_at = _parse_published_at(entry)
                    if cutoff and published_at <= cutoff:
                        continue
                    title = getattr(entry, "title", "").strip()
                    link = getattr(entry, "link", "").strip()
                    summary = getattr(entry, "summary", None)
                    if summary:
                        summary = summary.strip()[:500]
                    if not title or not link:
                        continue
                    articles[role].append({
                        "title": title,
                        "url": link,
                        "summary": summary,
                        "publishedAt": published_at.isoformat(),
                    })
            except Exception as e:
                logger.warning("[crawl] 피드 수집 실패 (skip): %s — %s", url, e)

    total = sum(len(v) for v in articles.values())
    if total == 0:
        raise AirflowSkipException("수집된 신규 기사가 없습니다.")

    kwargs["ti"].xcom_push(key="articles", value=articles)
    logger.info("[crawl] 수집 완료: %d건 (role별: %s)",
                total, {r: len(a) for r, a in articles.items()})


def filter_by_role(**kwargs):
    """직군 키워드 기반 기사 필터링."""
    from airflow.exceptions import AirflowSkipException

    articles: dict[str, list[dict]] | None = kwargs["ti"].xcom_pull(
        key="articles", task_ids="crawl_rss"
    )
    if not articles:
        raise AirflowSkipException("crawl_rss가 skip되었거나 articles가 없습니다.")

    filtered: dict[str, list[dict]] = {}
    for role, items in articles.items():
        keywords = ROLE_KEYWORD_MAP.get(role, [])
        passed = []
        for item in items:
            text = (item.get("title", "") + " " + (item.get("summary") or "")).lower()
            if not keywords or any(kw.lower() in text for kw in keywords):
                passed.append(item)
        if passed:
            filtered[role] = passed

    total = sum(len(v) for v in filtered.values())
    if total == 0:
        raise AirflowSkipException("키워드 필터 통과 기사가 없습니다.")

    kwargs["ti"].xcom_push(key="filtered_articles", value=filtered)
    logger.info("[filter] 필터 통과: %d건", total)


def deduplicate(**kwargs):
    """URL 기반 중복 제거 (동일 DAG 실행 내)."""
    from airflow.exceptions import AirflowSkipException

    filtered: dict[str, list[dict]] | None = kwargs["ti"].xcom_pull(
        key="filtered_articles", task_ids="filter_by_role"
    )
    if not filtered:
        raise AirflowSkipException("filter_by_role가 skip되었거나 filtered_articles가 없습니다.")

    seen_urls: set[str] = set()
    deduped: dict[str, list[dict]] = {}
    for role, items in filtered.items():
        unique = []
        for item in items:
            url = item["url"]
            if url not in seen_urls:
                seen_urls.add(url)
                unique.append(item)
        if unique:
            deduped[role] = unique

    total = sum(len(v) for v in deduped.values())
    if total == 0:
        raise AirflowSkipException("중복 제거 후 기사가 없습니다.")

    kwargs["ti"].xcom_push(key="deduped_articles", value=deduped)
    logger.info("[dedup] 중복 제거 후: %d건", total)


def load_to_s3(ds: str, **kwargs):
    """S3 Raw Zone 적재: news/YYYY/MM/DD/{role}.jsonl"""
    import boto3
    from airflow.exceptions import AirflowSkipException

    deduped: dict[str, list[dict]] | None = kwargs["ti"].xcom_pull(
        key="deduped_articles", task_ids="deduplicate"
    )
    if not deduped:
        raise AirflowSkipException("deduplicate가 skip되었거나 deduped_articles가 없습니다.")

    try:
        bucket = Variable.get("SEUNG_S3_ANALYTICS_BUCKET")
    except KeyError:
        raise AirflowSkipException("SEUNG_S3_ANALYTICS_BUCKET Variable이 설정되지 않았습니다.")

    date_path = ds.replace("-", "/")  # YYYY/MM/DD
    s3 = boto3.client("s3")

    for role, items in deduped.items():
        safe_role = role.replace("/", "_")
        key = f"news/{date_path}/{safe_role}.jsonl"
        body = "\n".join(json.dumps(item, ensure_ascii=False) for item in items)
        s3.put_object(Bucket=bucket, Key=key, Body=body.encode("utf-8"))
        logger.info("[s3] 적재 완료: s3://%s/%s (%d건)", bucket, key, len(items))


def upsert_db(**kwargs):
    """seung DB NewsArticle 테이블에 upsert. role별 상위 N건 초과 시 오래된 것 DELETE."""
    import psycopg2
    from psycopg2.extras import execute_values
    from airflow.exceptions import AirflowSkipException

    deduped: dict[str, list[dict]] | None = kwargs["ti"].xcom_pull(
        key="deduped_articles", task_ids="deduplicate"
    )
    if not deduped:
        raise AirflowSkipException("deduplicate가 skip되었거나 deduped_articles가 없습니다.")

    try:
        seung_db_url = Variable.get("SEUNG_DATABASE_URL")
    except KeyError:
        raise AirflowSkipException("SEUNG_DATABASE_URL Variable이 설정되지 않았습니다.")

    conn = psycopg2.connect(seung_db_url)
    try:
        with conn.cursor() as cur:
            for role, items in deduped.items():
                records = [
                    (
                        role,
                        item["title"],
                        item["url"],
                        item.get("summary"),
                        item["publishedAt"],
                    )
                    for item in items
                ]
                execute_values(
                    cur,
                    """
                    INSERT INTO "NewsArticle" (role, title, url, summary, "publishedAt")
                    VALUES %s
                    ON CONFLICT (url) DO NOTHING
                    """,
                    records,
                )
                logger.info("[upsert] role=%s %d건 insert 시도", role, len(records))

                cur.execute(
                    """
                    DELETE FROM "NewsArticle"
                    WHERE role = %s
                      AND id NOT IN (
                        SELECT id FROM "NewsArticle"
                        WHERE role = %s
                        ORDER BY "publishedAt" DESC
                        LIMIT %s
                      )
                    """,
                    (role, role, MAX_ARTICLES_PER_ROLE),
                )
                deleted = cur.rowcount
                if deleted > 0:
                    logger.info("[upsert] role=%s 오래된 기사 %d건 삭제", role, deleted)

        conn.commit()
    finally:
        conn.close()


with DAG(
    dag_id="seung_news_dag",
    default_args=default_args,
    schedule="0 0 * * *",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["mirai", "seung", "news", "rss"],
) as dag:
    t1 = PythonOperator(task_id="crawl_rss", python_callable=crawl_rss)
    t2 = PythonOperator(task_id="filter_by_role", python_callable=filter_by_role)
    t3 = PythonOperator(task_id="deduplicate", python_callable=deduplicate)
    t4 = PythonOperator(task_id="load_to_s3", python_callable=load_to_s3)
    t5 = PythonOperator(task_id="upsert_db", python_callable=upsert_db, trigger_rule="all_done")
    t1 >> t2 >> t3 >> t4 >> t5
