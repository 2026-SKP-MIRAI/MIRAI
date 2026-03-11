-- CreateTable
CREATE TABLE "Resume" (
    "id" TEXT NOT NULL,
    "resumeText" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSession" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "questionsQueue" JSONB NOT NULL,
    "history" JSONB NOT NULL,
    "sessionComplete" BOOLEAN NOT NULL DEFAULT false,
    "currentQuestion" TEXT NOT NULL,
    "currentPersona" TEXT NOT NULL,
    "currentPersonaLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
