-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "resumes" (
    "id" TEXT NOT NULL,
    "resumeText" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "storageKey" TEXT,
    "inferredTargetRole" TEXT,
    "diagnosisResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_sessions" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "questionsQueue" JSONB NOT NULL,
    "history" JSONB NOT NULL,
    "currentQuestion" TEXT NOT NULL,
    "currentPersona" TEXT NOT NULL,
    "currentPersonaLabel" TEXT NOT NULL DEFAULT '',
    "currentQuestionType" TEXT NOT NULL DEFAULT 'main',
    "sessionComplete" BOOLEAN NOT NULL DEFAULT false,
    "interviewMode" TEXT NOT NULL DEFAULT 'real',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "scores" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "axisFeedbacks" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reports_sessionId_key" ON "reports"("sessionId");

-- AddForeignKey
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "interview_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

