-- CreateTable
CREATE TABLE "resumes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "resumeText" TEXT NOT NULL,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resumes_userId_idx" ON "resumes"("userId");

-- AddColumn: InterviewSession.resumeId
ALTER TABLE "interview_sessions" ADD COLUMN "resumeId" UUID;

-- AddForeignKey
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropTable: resume_sessions (replaced by resumes)
DROP TABLE IF EXISTS "resume_sessions";

-- RLS: resumes 테이블 (#88 auth.uid()::text 패턴 준수)
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'resumes' AND policyname = 'users_own_resumes'
  ) THEN
    CREATE POLICY "users_own_resumes"
      ON resumes FOR ALL
      USING (auth.uid()::text = "userId");
  END IF;
END $$;
