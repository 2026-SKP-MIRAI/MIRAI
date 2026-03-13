-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."interview_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resumeText" TEXT NOT NULL,
    "currentQuestion" TEXT NOT NULL DEFAULT '',
    "currentPersona" TEXT NOT NULL DEFAULT '',
    "questionsQueue" JSONB NOT NULL DEFAULT '[]',
    "history" JSONB NOT NULL DEFAULT '[]',
    "sessionComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentQuestionType" TEXT NOT NULL DEFAULT 'main',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "interview_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."resume_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resumeText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resume_sessions_pkey" PRIMARY KEY ("id")
);
