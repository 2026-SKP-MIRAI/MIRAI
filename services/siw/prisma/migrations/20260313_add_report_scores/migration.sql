-- Add report scores fields to interview_sessions
ALTER TABLE "interview_sessions"
  ADD COLUMN IF NOT EXISTS "reportScores" JSONB,
  ADD COLUMN IF NOT EXISTS "reportTotalScore" INTEGER;
