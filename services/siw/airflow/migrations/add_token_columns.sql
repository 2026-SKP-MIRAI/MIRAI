-- #96: llm_events_daily에 token 사용량 컬럼 추가
ALTER TABLE analytics.llm_events_daily
  ADD COLUMN IF NOT EXISTS total_tokens       INT     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd FLOAT   DEFAULT 0.0;

COMMENT ON COLUMN analytics.llm_events_daily.total_tokens       IS 'Daily total LLM tokens (prompt + completion)';
COMMENT ON COLUMN analytics.llm_events_daily.estimated_cost_usd IS 'Estimated daily LLM cost in USD';
