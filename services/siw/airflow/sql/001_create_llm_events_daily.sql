CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.llm_events_daily (
  date           DATE          NOT NULL,
  feature_type   TEXT          NOT NULL,
  call_count     INTEGER       NOT NULL DEFAULT 0,
  avg_latency_ms NUMERIC(10,2) NOT NULL DEFAULT 0.0,  -- updated_at는 UPSERT 시 명시적으로 갱신 (트리거 미사용)
  error_count    INTEGER       NOT NULL DEFAULT 0,
  error_rate     REAL          NOT NULL DEFAULT 0.0,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  PRIMARY KEY (date, feature_type)
);
CREATE INDEX IF NOT EXISTS idx_llm_events_daily_date ON analytics.llm_events_daily (date);
