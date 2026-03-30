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

-- RLS: resume_submissions (#301)
ALTER TABLE "ResumeSubmission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "readonly_select" ON "ResumeSubmission"
  FOR SELECT USING (true);  -- seung_readonly (Airflow DAG) 접근 허용
-- Note: GRANT SELECT ON "ResumeSubmission" TO seung_readonly; 는 seung_readonly 롤 설정에 포함
