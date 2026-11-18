CREATE TABLE "ProgrammeAssignment" ("id" TEXT NOT NULL, "cohortId" TEXT NOT NULL, "title" TEXT NOT NULL, "instructions" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProgrammeAssignment_pkey" PRIMARY KEY ("id"));
CREATE TABLE "ProgrammeSubmission" ("id" TEXT NOT NULL, "assignmentId" TEXT NOT NULL, "applicantId" TEXT NOT NULL, "content" TEXT NOT NULL, "feedback" TEXT, "score" INTEGER, "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reviewedAt" TIMESTAMP(3), CONSTRAINT "ProgrammeSubmission_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ProgrammeAssignment_cohortId_createdAt_idx" ON "ProgrammeAssignment"("cohortId", "createdAt");
CREATE UNIQUE INDEX "ProgrammeSubmission_assignmentId_applicantId_key" ON "ProgrammeSubmission"("assignmentId", "applicantId");
CREATE INDEX "ProgrammeSubmission_applicantId_idx" ON "ProgrammeSubmission"("applicantId");
ALTER TABLE "ProgrammeAssignment" ADD CONSTRAINT "ProgrammeAssignment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "ProgrammeCohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgrammeSubmission" ADD CONSTRAINT "ProgrammeSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ProgrammeAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
