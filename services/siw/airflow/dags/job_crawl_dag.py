"""
job_crawl_dag — 잡코리아 채용공고 크롤링 + pgvector upsert
스케줄: 매주 일요일 UTC 15:00
"""
import json
import time
import logging
import os
from datetime import datetime, timedelta
from urllib.robotparser import RobotFileParser
from urllib.parse import urljoin

import boto3
import psycopg2
import requests
from bs4 import BeautifulSoup
from airflow import DAG
from airflow.models import Variable
from airflow.operators.python import PythonOperator

log = logging.getLogger(__name__)

JOBKOREA_BASE = "https://www.jobkorea.co.kr"
TOP100_BASE_URL = "https://www.jobkorea.co.kr/top100/?Search_Type=2&BCtgrCode={code}"

# 전공 대분류 (실제 HTML data-bctgrcode 기준, BCtgrCode=0 전공전체 제외)
MAJOR_CATEGORIES = {
    1:  "어문학",
    2:  "인문과학",
    3:  "사회과학",
    4:  "자연과학",
    5:  "공학",
    6:  "법학",
    7:  "사범학",
    8:  "상경",
    9:  "생활과학",
    10: "예/체능학",
    12: "의/약학",
    13: "농/수산/해양학",
}

# 우대사항·자격요건 추출 대상 키워드
QUALIF_KEYWORDS = ["우대사항", "자격요건", "담당업무", "주요업무", "필수요건", "우대조건", "복리후생", "지원자격"]

USER_AGENT = "MirAI-Crawler/1.0 (+https://mirai.example.com/bot)"
RATE_LIMIT_SEC = 1.0

default_args = {
    "owner": "mirai",
    "retries": 0,
    "execution_timeout": timedelta(hours=2),
}

dag = DAG(
    dag_id="job_crawl_dag",
    default_args=default_args,
    schedule_interval="0 15 * * 0",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["mirai", "rag", "crawl"],
)


def _get_s3_client():
    return boto3.client(
        "s3",
        aws_access_key_id=Variable.get("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=Variable.get("AWS_SECRET_ACCESS_KEY"),
        region_name=Variable.get("AWS_REGION", default_var="ap-northeast-2"),
    )


def _get_robot_parser() -> RobotFileParser:
    rp = RobotFileParser()
    rp.set_url(urljoin(JOBKOREA_BASE, "/robots.txt"))
    rp.read()
    return rp


def _parse_top10(soup: "BeautifulSoup", job_role: str) -> list:
    """ol.rankList > li 파싱 → 기본 posting dict 리스트 반환"""
    results = []
    for item in soup.select("ol.rankList > li"):
        rank_el = item.select_one("div.rank span.num")
        rank = rank_el.get_text(strip=True) if rank_el else ""

        co_el = item.select_one("div.coTit")
        if co_el:
            for btn in co_el.find_all("button"):
                btn.decompose()
        company = co_el.get_text(strip=True) if co_el else ""

        title_a = item.select_one("div.tit a.link")
        title = title_a.get_text(strip=True) if title_a else ""
        href = title_a.get("href", "") if title_a else ""
        if href and not href.startswith("http"):
            href = JOBKOREA_BASE + href

        skills_el = item.select("div.sTit span")
        skills = " ".join(s.get_text(strip=True) for s in skills_el)

        cond_el = item.select_one("div.sDsc")
        conditions = cond_el.get_text(strip=True) if cond_el else ""

        if not title or not href:
            continue

        results.append({
            "job_role": job_role,
            "rank": rank,
            "title": title,
            "company": company,
            "skills": skills,
            "conditions": conditions,
            "source_url": href,
        })
    return results


def crawl_jobkorea(ds: str, **context) -> None:
    """잡코리아 전공 대분류별 TOP10 채용공고 크롤링 → S3 raw.jsonl 업로드
    총 요청: 12 listing + 최대 120 detail ≈ 132회 (Rate limit 1s 준수)
    """
    bucket = Variable.get("S3_RAG_BUCKET_NAME")
    s3_key = f"job-crawl/{ds.replace('-', '/')}/raw.jsonl"

    rp = _get_robot_parser()
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    session.headers["Accept-Language"] = "ko-KR,ko;q=0.9"

    # 1단계: 전공 대분류별 TOP10 목록 수집
    # 같은 공고가 여러 카테고리에 등장할 수 있으나 job_role이 다르므로 모두 수집
    # DB upsert 단계에서 (source_url, job_role) 기준 중복 처리
    postings = []

    for code, category_name in MAJOR_CATEGORIES.items():
        url = TOP100_BASE_URL.format(code=code)
        if not rp.can_fetch(USER_AGENT, url):
            log.warning("robots.txt disallows: %s", url)
            continue
        try:
            time.sleep(RATE_LIMIT_SEC)
            resp = session.get(url, timeout=10)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.content, "lxml")
            items = _parse_top10(soup, job_role=category_name)
            postings.extend(items)
            log.info("[%s] listing: %d건 (누적 %d건)", category_name, len(items), len(postings))
        except Exception as e:
            log.error("Listing crawl error [%s]: %s", category_name, e)

    log.info("Listing done: %d건 across %d categories", len(postings), len(MAJOR_CATEGORIES))

    # 2단계: 각 공고 상세 페이지 방문 → 우대사항·자격요건 추출
    for posting in postings:
        detail_url = posting["source_url"]
        if not rp.can_fetch(USER_AGENT, detail_url):
            posting["content"] = f"{posting['title']} {posting['skills']}".strip()
            continue
        try:
            time.sleep(RATE_LIMIT_SEC)
            dresp = session.get(detail_url, timeout=10)
            dresp.raise_for_status()
            dsoup = BeautifulSoup(dresp.content, "lxml")

            parts = []

            # 방법 1: table.tplTbl 행별 추출 (잡코리아 표준 템플릿)
            for table in dsoup.select("table.tplTbl"):
                for row in table.find_all("tr"):
                    th = row.find("th")
                    tds = row.find_all("td")
                    if not th or not tds:
                        continue
                    header = th.get_text(strip=True)
                    if any(kw in header for kw in QUALIF_KEYWORDS):
                        content = " ".join(td.get_text(" ", strip=True) for td in tds)
                        if len(content) > 5:
                            parts.append(f"[{header}] {content}")

            # 방법 2: 키워드 포함 텍스트 스니펫 (body 전체 스캔)
            if not parts:
                for tag in dsoup(["script", "style", "header", "footer", "nav", "aside"]):
                    tag.decompose()
                full_text = dsoup.get_text(" ", strip=True)
                for kw in QUALIF_KEYWORDS:
                    idx = full_text.find(kw)
                    while idx != -1 and len(parts) < 6:
                        snippet = full_text[idx:idx + 500].strip()
                        if snippet not in parts:
                            parts.append(snippet)
                        idx = full_text.find(kw, idx + len(kw))

            # 방법 3: 폴백 — body 앞부분
            if not parts:
                for tag in dsoup(["script", "style", "header", "footer", "nav", "aside"]):
                    tag.decompose()
                body_text = dsoup.get_text(" ", strip=True)
                if len(body_text) > 100:
                    parts = [body_text[:2000]]

            detail_text = " ".join(parts)[:3000] if parts else ""
            posting["content"] = f"{posting['title']} {posting['skills']} {detail_text}".strip()
        except Exception as e:
            log.error("Detail crawl error [%s]: %s", detail_url, e)
            posting["content"] = f"{posting['title']} {posting['skills']}".strip()

    log.info("Crawled %d postings with detail content", len(postings))

    # S3 업로드
    s3 = _get_s3_client()
    body = "\n".join(json.dumps(p, ensure_ascii=False) for p in postings)
    s3.put_object(Bucket=bucket, Key=s3_key, Body=body.encode("utf-8"))
    log.info("Uploaded %d postings to s3://%s/%s", len(postings), bucket, s3_key)

    # XCom에 S3 key만 전달 (대용량 텍스트 금지)
    context["ti"].xcom_push(key="raw_s3_key", value=s3_key)


def embed_postings(ds: str, **context) -> None:
    """raw.jsonl → 엔진 /api/embed 배치 호출 → embedded.jsonl → S3"""
    bucket = Variable.get("S3_RAG_BUCKET_NAME")
    engine_url = Variable.get("ENGINE_BASE_URL")
    raw_key = context["ti"].xcom_pull(task_ids="crawl_jobkorea", key="raw_s3_key")
    embedded_key = f"job-crawl/{ds.replace('-', '/')}/embedded.jsonl"

    s3 = _get_s3_client()
    obj = s3.get_object(Bucket=bucket, Key=raw_key)
    lines = obj["Body"].read().decode("utf-8").strip().split("\n")
    postings = [json.loads(line) for line in lines if line.strip()]

    # 배치 100건씩
    embedded = []
    for i in range(0, len(postings), 100):
        batch = postings[i : i + 100]
        texts = [p["content"] for p in batch]
        resp = requests.post(
            f"{engine_url}/api/embed",
            json={"texts": texts, "model": "baai/bge-m3"},
            timeout=60,
        )
        resp.raise_for_status()
        vectors = resp.json()["embeddings"]
        for posting, vec in zip(batch, vectors):
            embedded.append({**posting, "embedding": vec})
        log.info("임베딩 완료: %d / %d", len(embedded), len(postings))

    body = "\n".join(json.dumps(e, ensure_ascii=False) for e in embedded)
    s3.put_object(Bucket=bucket, Key=embedded_key, Body=body.encode("utf-8"))
    log.info("Embedded %d postings → s3://%s/%s", len(embedded), bucket, embedded_key)

    context["ti"].xcom_push(key="embedded_s3_key", value=embedded_key)


def upsert_vectors(ds: str, **context) -> None:
    """embedded.jsonl → pgvector upsert"""
    bucket = Variable.get("S3_RAG_BUCKET_NAME")
    pg_conn_str = Variable.get("RAG_POSTGRES_CONN_ID")
    embedded_key = context["ti"].xcom_pull(task_ids="embed_postings", key="embedded_s3_key")

    s3 = _get_s3_client()
    obj = s3.get_object(Bucket=bucket, Key=embedded_key)
    lines = obj["Body"].read().decode("utf-8").strip().split("\n")
    records = [json.loads(line) for line in lines if line.strip()]

    conn = psycopg2.connect(pg_conn_str)
    try:
        with conn.cursor() as cur:
            for r in records:
                # embedding은 문자열 직렬화 필수 (psycopg2 pgvector 호환)
                vec_str = "[" + ",".join(str(v) for v in r["embedding"]) + "]"
                cur.execute(
                    """
                    INSERT INTO job_posting_embeddings
                      (job_role, title, company, content, embedding, source_url)
                    VALUES (%s, %s, %s, %s, %s::vector, %s)
                    ON CONFLICT (source_url, job_role) DO UPDATE SET
                      title = EXCLUDED.title,
                      company = EXCLUDED.company,
                      content = EXCLUDED.content,
                      embedding = EXCLUDED.embedding,
                      crawled_at = now()
                    """,
                    (r["job_role"], r["title"], r["company"], r["content"], vec_str, r["source_url"]),
                )
        conn.commit()
        log.info("Upserted %d records", len(records))
    finally:
        conn.close()

    context["ti"].xcom_push(key="upserted_count", value=len(records))


def log_summary(**context) -> None:
    """처리 결과 로그"""
    count = context["ti"].xcom_pull(task_ids="upsert_vectors", key="upserted_count") or 0
    log.info("job_crawl_dag completed. Upserted %d job postings.", count)


t1 = PythonOperator(task_id="crawl_jobkorea", python_callable=crawl_jobkorea, dag=dag)
t2 = PythonOperator(task_id="embed_postings", python_callable=embed_postings, dag=dag)
t3 = PythonOperator(task_id="upsert_vectors", python_callable=upsert_vectors, dag=dag)
t4 = PythonOperator(task_id="log_summary", python_callable=log_summary, dag=dag)

t1 >> t2 >> t3 >> t4
