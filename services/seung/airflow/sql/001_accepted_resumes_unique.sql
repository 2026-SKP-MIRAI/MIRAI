-- #293 ON CONFLICT DO NOTHING 실제 동작을 위한 UNIQUE 인덱스 추가
-- 실행 대상: 공용 RAG Supabase (RAG_DATABASE_URL)
--
-- content 컬럼은 자소서 전문이라 길이 제한(btree 8KB) 초과 가능 →
-- md5 해시 기반 함수형 인덱스로 안전하게 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_are_content_hash
  ON accepted_resume_embeddings ((md5(content)));
