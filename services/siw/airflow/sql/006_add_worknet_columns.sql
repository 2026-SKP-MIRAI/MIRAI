-- 워크넷 연동을 위한 컬럼 추가 (비파괴적 마이그레이션)
ALTER TABLE job_posting_embeddings
  ADD COLUMN IF NOT EXISTS pref_cond TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS job_cd    VARCHAR(10) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_jpe_job_cd ON job_posting_embeddings (job_cd);
