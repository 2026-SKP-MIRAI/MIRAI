-- AlterTable: add interviewMode column to interview_sessions
ALTER TABLE "interview_sessions" ADD COLUMN IF NOT EXISTS "interviewMode" TEXT NOT NULL DEFAULT 'real';
