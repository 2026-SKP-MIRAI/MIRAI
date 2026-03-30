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
-- 소유자는 자신의 제출만 조회 가능 (anon key 직접 접근 차단)
CREATE POLICY "owner_only" ON "ResumeSubmission"
  FOR SELECT USING (auth.uid()::text = "userId");
-- seung_readonly (Airflow DAG) 전체 조회 허용 — 특정 롤에만 적용
CREATE POLICY "readonly_select" ON "ResumeSubmission"
  FOR SELECT TO seung_readonly USING (true);
-- Note: GRANT SELECT ON "ResumeSubmission" TO seung_readonly; 는 seung_readonly 롤 설정에 포함
