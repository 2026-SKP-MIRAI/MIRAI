-- interview_sessions RLS 활성화
-- Prisma로 생성된 테이블은 RLS가 자동으로 비활성화되므로 수동 활성화 필요

ALTER TABLE "InterviewSession" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_sessions"
  ON "InterviewSession"
  FOR ALL
  USING (auth.uid()::text = "userId");

-- 서비스 롤은 RLS 우회 (createServiceClient로 DB 접근 시 영향 없음)
-- userId가 null인 기존 세션은 이 정책에서 자동 제외됨
