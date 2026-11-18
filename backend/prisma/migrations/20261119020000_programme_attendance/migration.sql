CREATE TABLE "ProgrammeAttendanceSession" ("id" TEXT NOT NULL, "cohortId" TEXT NOT NULL, "title" VARCHAR(160) NOT NULL, "heldAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProgrammeAttendanceSession_pkey" PRIMARY KEY ("id"));
CREATE TABLE "ProgrammeAttendanceRecord" ("id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "applicantId" TEXT NOT NULL, "present" BOOLEAN NOT NULL, "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProgrammeAttendanceRecord_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ProgrammeAttendanceSession_cohortId_heldAt_idx" ON "ProgrammeAttendanceSession"("cohortId", "heldAt");
CREATE UNIQUE INDEX "ProgrammeAttendanceRecord_sessionId_applicantId_key" ON "ProgrammeAttendanceRecord"("sessionId", "applicantId");
CREATE INDEX "ProgrammeAttendanceRecord_applicantId_idx" ON "ProgrammeAttendanceRecord"("applicantId");
ALTER TABLE "ProgrammeAttendanceSession" ADD CONSTRAINT "ProgrammeAttendanceSession_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "ProgrammeCohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgrammeAttendanceRecord" ADD CONSTRAINT "ProgrammeAttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProgrammeAttendanceSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
