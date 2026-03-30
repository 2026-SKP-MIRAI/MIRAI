-- CreateTable
CREATE TABLE "ResumeSubmission" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "jobRole" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "company" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeSubmission_pkey" PRIMARY KEY ("id")
);
