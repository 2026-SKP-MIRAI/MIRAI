-- Migration: Add is_public column to reports table for SNS sharing (Issue #184)
-- Date: 2026-03-25

-- RLS 활성화 (이미 활성화된 경우 no-op)
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- is_public 컬럼 추가 (DEFAULT false — 신규 리포트만 공유 허용, 기존 리포트 소급 공개 방지)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

-- RLS 정책: anon 사용자가 is_public=true 리포트를 읽을 수 있도록 허용
CREATE POLICY "public reports are viewable by everyone"
  ON reports
  FOR SELECT
  TO anon
  USING (is_public = true);

-- 주의: 이 마이그레이션 실행 전 Supabase 대시보드에서
-- reports 테이블의 기존 RLS 정책을 확인하세요.
-- 기존 인증된 사용자 SELECT 정책이 있는지 확인이 필요합니다.
