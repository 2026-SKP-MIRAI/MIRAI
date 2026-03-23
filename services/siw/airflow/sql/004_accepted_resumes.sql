-- #198 pre-alignment: accepted_resume_embeddings 테이블
-- 실행 대상: 공용 RAG Supabase (RAG_DATABASE_URL)
-- #198 이슈에서 데이터 적재 및 route 연동 예정

CREATE TABLE IF NOT EXISTS accepted_resume_embeddings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_role   TEXT        NOT NULL,
  content    TEXT        NOT NULL,
  embedding  vector(1024) NOT NULL,
  source     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_are_embedding
  ON accepted_resume_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);
