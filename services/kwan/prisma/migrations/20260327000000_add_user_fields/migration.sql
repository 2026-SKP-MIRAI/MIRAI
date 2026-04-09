-- AlterTable
ALTER TABLE "resumes" ADD COLUMN "userId" TEXT;
ALTER TABLE "resumes" ADD COLUMN "fileName" TEXT;

-- AlterTable
ALTER TABLE "interview_sessions" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "reports" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "resumes_userId_idx" ON "resumes"("userId");
