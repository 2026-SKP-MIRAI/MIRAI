-- RLS: resumes
ALTER TABLE "Resume" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON "Resume"
  USING (auth.uid()::text = "userId");

-- RLS: interview_sessions
ALTER TABLE "InterviewSession" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON "InterviewSession"
  USING (auth.uid()::text = "userId");

-- RLS: reports
ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON "Report"
  USING (auth.uid()::text = "userId");
