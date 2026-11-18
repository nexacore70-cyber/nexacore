CREATE TYPE "ProgrammeKind" AS ENUM ('BOOTCAMP','INTERNSHIP');
CREATE TYPE "ProgrammeState" AS ENUM ('DRAFT','OPEN','CLOSED');
CREATE TYPE "ProgrammeApplicationState" AS ENUM ('APPLIED','ACCEPTED','REJECTED','WITHDRAWN');
CREATE TABLE "ProgrammeCohort" (
 "id" TEXT NOT NULL, "tutorId" TEXT NOT NULL, "kind" "ProgrammeKind" NOT NULL,
 "title" TEXT NOT NULL, "description" TEXT NOT NULL, "startsAt" TIMESTAMP(3),
 "endsAt" TIMESTAMP(3), "capacity" INTEGER, "state" "ProgrammeState" NOT NULL DEFAULT 'DRAFT',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ProgrammeCohort_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProgrammeApplication" (
 "id" TEXT NOT NULL,"cohortId" TEXT NOT NULL,"applicantId" TEXT NOT NULL,
 "motivation" TEXT NOT NULL,"state" "ProgrammeApplicationState" NOT NULL DEFAULT 'APPLIED',
 "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"reviewedAt" TIMESTAMP(3),
 CONSTRAINT "ProgrammeApplication_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProgrammeCohort_kind_state_idx" ON "ProgrammeCohort"("kind","state");
CREATE INDEX "ProgrammeCohort_tutorId_idx" ON "ProgrammeCohort"("tutorId");
CREATE INDEX "ProgrammeApplication_applicantId_state_idx" ON "ProgrammeApplication"("applicantId","state");
CREATE UNIQUE INDEX "ProgrammeApplication_cohortId_applicantId_key" ON "ProgrammeApplication"("cohortId","applicantId");
ALTER TABLE "ProgrammeCohort" ADD CONSTRAINT "ProgrammeCohort_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgrammeApplication" ADD CONSTRAINT "ProgrammeApplication_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "ProgrammeCohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgrammeApplication" ADD CONSTRAINT "ProgrammeApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
