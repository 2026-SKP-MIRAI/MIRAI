-- #98: llm_events_daily에 입력/출력 토큰 분리 컬럼 추가
-- DAG aggregate_metrics에서 prompt_tokens, completion_tokens를 분리 집계
ALTER TABLE analytics.llm_events_daily
  ADD COLUMN IF NOT EXISTS prompt_tokens     INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_tokens INT DEFAULT 0;

COMMENT ON COLUMN analytics.llm_events_daily.prompt_tokens     IS 'Daily total input (prompt) tokens — for prompt optimization monitoring';
COMMENT ON COLUMN analytics.llm_events_daily.completion_tokens IS 'Daily total output (completion) tokens — for generation length monitoring';
