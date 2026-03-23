-- job_posting_embeddings UNIQUE 제약 변경:
-- source_url 단독 → (source_url, job_role) 복합 키
-- 같은 공고가 여러 전공 카테고리에 등장할 수 있으므로 복합 키 필요

-- 기존 제약 제거
ALTER TABLE job_posting_embeddings
  DROP CONSTRAINT IF EXISTS job_posting_embeddings_source_url_key;

-- 복합 UNIQUE 제약 추가
ALTER TABLE job_posting_embeddings
  ADD CONSTRAINT job_posting_embeddings_source_url_job_role_key
  UNIQUE (source_url, job_role);
