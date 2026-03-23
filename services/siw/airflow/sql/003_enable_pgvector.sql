-- pgvector extension 활성화 (Supabase Dashboard에서 수동 실행 또는 SQL Editor)
CREATE EXTENSION IF NOT EXISTS vector;

-- job_posting_embeddings 테이블
CREATE TABLE IF NOT EXISTS job_posting_embeddings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_role    TEXT NOT NULL,
  title       TEXT NOT NULL,
  company     TEXT NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector(1024) NOT NULL,
  source_url  TEXT NOT NULL,
  crawled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_url, job_role)
);

-- 검색 인덱스 (job_role 필터링)
CREATE INDEX IF NOT EXISTS idx_jpe_job_role ON job_posting_embeddings (job_role);

-- IVFFlat cosine 인덱스
-- ⚠️ 초기 적재량 1,000건 미만이면 seq scan이 유리. 1,000건 이상 적재 후 REINDEX 권장.
CREATE INDEX IF NOT EXISTS idx_jpe_embedding ON job_posting_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
