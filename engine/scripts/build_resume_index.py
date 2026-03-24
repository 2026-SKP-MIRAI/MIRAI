#!/usr/bin/env python3
"""
합격 자소서 임베딩 인덱스 빌더
============================
합격 자소서 JSON 파일을 읽어 엔진 /api/embed 엔드포인트로 배치 임베딩 후
공용 Supabase(RAG_DATABASE_URL)의 accepted_resume_embeddings 테이블에 upsert한다.

사용법:
  python engine/scripts/build_resume_index.py --input data/accepted_resumes.json
  python engine/scripts/build_resume_index.py --dry-run

환경변수:
  ENGINE_BASE_URL  = http://localhost:8000 (기본값)
  RAG_DATABASE_URL = postgresql://...  (공용 Supabase, 팀 공유)
                     ※ 개인 DATABASE_URL이 아닌 RAG_DATABASE_URL을 사용할 것

입력 형식:
  [{"job_role": "백엔드", "content": "...", "source": "optional"}, ...]

주의사항:
  - 배치 크기는 100개 (엔진 /api/embed max_length=100 제한 준수)
  - 임베딩 모델은 baai/bge-m3 고정 (1024차원)
  - upsert 시 ON CONFLICT DO NOTHING (중복 레코드 무시)
  - --dry-run 플래그로 DB 쓰기 없이 입력 검증만 수행 가능
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests
import psycopg2
from psycopg2.extras import execute_values

BATCH_SIZE = 100
EMBED_TIMEOUT = 60
EMBED_MODEL = "baai/bge-m3"
EMBED_DIM = 1024


def load_resumes(path: Path) -> list[dict]:
    """JSON 파일에서 합격 자소서 목록을 로드하고 기본 검증을 수행한다."""
    if not path.exists():
        print(f"[오류] 입력 파일이 존재하지 않습니다: {path}", file=sys.stderr)
        sys.exit(1)

    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        print("[오류] 입력 JSON은 배열이어야 합니다.", file=sys.stderr)
        sys.exit(1)

    valid = []
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            print(f"[경고] 항목 {i}: dict가 아님 — 건너뜀", file=sys.stderr)
            continue
        if not item.get("job_role") or not item.get("content"):
            print(f"[경고] 항목 {i}: job_role 또는 content 누락 — 건너뜀", file=sys.stderr)
            continue
        valid.append({
            "job_role": str(item["job_role"]).strip(),
            "content": str(item["content"]).strip(),
            "source": str(item.get("source", "")).strip(),
        })

    return valid


def batches(items: list, size: int):
    """items를 size 크기의 배치로 나누어 yield한다."""
    for i in range(0, len(items), size):
        yield items[i:i + size]


def embed_batch(texts: list[str], engine_url: str) -> list[list[float]]:
    """
    엔진 /api/embed 엔드포인트에 텍스트 배치를 전송하고 임베딩 벡터를 반환한다.

    각 임베딩은 1024차원이어야 한다. 검증 실패 시 RuntimeError를 발생시킨다.
    """
    url = f"{engine_url.rstrip('/')}/api/embed"
    payload = {"texts": texts, "model": EMBED_MODEL}

    resp = requests.post(url, json=payload, timeout=EMBED_TIMEOUT)
    resp.raise_for_status()

    data = resp.json()
    embeddings = data.get("embeddings") or data.get("data") or data

    if not isinstance(embeddings, list):
        raise RuntimeError(f"임베딩 응답 형식 오류: {type(embeddings)}")

    if len(embeddings) != len(texts):
        raise RuntimeError(
            f"임베딩 수 불일치: 요청={len(texts)}, 응답={len(embeddings)}"
        )

    for i, emb in enumerate(embeddings):
        if not isinstance(emb, list) or len(emb) != EMBED_DIM:
            raise RuntimeError(
                f"임베딩 {i}: 차원 오류 (기대={EMBED_DIM}, 실제={len(emb) if isinstance(emb, list) else 'N/A'})"
            )

    return embeddings


def upsert_batch(conn, records: list[tuple]) -> int:
    """
    accepted_resume_embeddings 테이블에 레코드를 upsert한다.

    records: [(job_role, content, embedding_str, source), ...]
    반환값: 삽입된 레코드 수
    """
    sql = """
        INSERT INTO accepted_resume_embeddings (job_role, content, embedding, source)
        VALUES %s
        ON CONFLICT DO NOTHING
    """
    template = "(%s, %s, %s::vector, %s)"

    with conn.cursor() as cur:
        execute_values(cur, sql, records, template=template)
        conn.commit()
        return cur.rowcount if cur.rowcount >= 0 else len(records)


def main():
    parser = argparse.ArgumentParser(
        description="합격 자소서 JSON → 엔진 임베딩 → Supabase upsert"
    )
    parser.add_argument(
        "--input",
        default="data/accepted_resumes.json",
        help="입력 JSON 파일 경로 (기본값: data/accepted_resumes.json)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="입력 검증만 수행, DB 쓰기 없음",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    engine_url = os.environ.get("ENGINE_BASE_URL", "http://localhost:8000")
    db_url = os.environ.get("RAG_DATABASE_URL", "")

    print(f"[설정] 입력 파일: {input_path}")
    print(f"[설정] 엔진 URL: {engine_url}")
    if args.dry_run:
        print("[설정] dry-run 모드: DB 쓰기 없음")
    else:
        if not db_url:
            print(
                "[오류] RAG_DATABASE_URL 환경변수가 설정되지 않았습니다.",
                file=sys.stderr,
            )
            sys.exit(1)
        print(f"[설정] DB: {db_url[:40]}...")

    # 1. 입력 로드 및 검증
    resumes = load_resumes(input_path)
    total = len(resumes)
    batch_count = (total + BATCH_SIZE - 1) // BATCH_SIZE
    print(f"\n[로드] 총 {total}개 레코드, {batch_count}개 배치")

    if args.dry_run:
        print(f"[dry-run] 검증 완료. 배치 수: {batch_count}, 레코드 수: {total}")
        print("[dry-run] 실제 임베딩/DB 처리는 수행하지 않습니다.")
        return

    # 2. DB 연결
    try:
        conn = psycopg2.connect(db_url)
    except Exception as e:
        print(f"[오류] DB 연결 실패: {e}", file=sys.stderr)
        sys.exit(1)

    # 3. 배치 임베딩 + upsert
    total_inserted = 0

    for batch_idx, batch in enumerate(batches(resumes, BATCH_SIZE), 1):
        print(f"배치 {batch_idx}/{batch_count}: {len(batch)}개 처리 중...")

        texts = [item["content"] for item in batch]

        # 임베딩 요청 (실패 시 1회 재시도)
        embeddings = None
        for attempt in range(2):
            try:
                embeddings = embed_batch(texts, engine_url)
                break
            except Exception as e:
                if attempt == 0:
                    print(f"  [재시도] 배치 {batch_idx} 임베딩 실패: {e}")
                    time.sleep(1)
                else:
                    print(f"  [경고] 배치 {batch_idx} 건너뜀: {e}", file=sys.stderr)

        if embeddings is None:
            time.sleep(0.1)
            continue

        # 레코드 구성
        records = []
        for item, emb in zip(batch, embeddings):
            embedding_str = "[" + ",".join(map(str, emb)) + "]"
            records.append((item["job_role"], item["content"], embedding_str, item["source"]))

        # upsert (실패 시 1회 재시도)
        for attempt in range(2):
            try:
                inserted = upsert_batch(conn, records)
                total_inserted += inserted
                break
            except Exception as e:
                conn.rollback()
                if attempt == 0:
                    print(f"  [재시도] 배치 {batch_idx} upsert 실패: {e}")
                    time.sleep(1)
                else:
                    print(f"  [경고] 배치 {batch_idx} upsert 건너뜀: {e}", file=sys.stderr)

        time.sleep(0.1)

    conn.close()
    print(f"\n완료: 총 {total_inserted}개 레코드 삽입")


if __name__ == "__main__":
    main()
