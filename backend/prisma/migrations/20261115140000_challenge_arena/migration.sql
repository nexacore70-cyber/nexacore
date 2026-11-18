CREATE TABLE "challenges" (
"id" TEXT NOT NULL,"title" VARCHAR(120) NOT NULL,"description" VARCHAR(4000) NOT NULL,
"category" VARCHAR(50) NOT NULL,"status" TEXT NOT NULL DEFAULT 'PUBLISHED',
"deadline" TIMESTAMP(3) NOT NULL,"creatorId" TEXT NOT NULL,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "challenges_pkey" PRIMARY KEY ("id"),
CONSTRAINT "challenges_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
CONSTRAINT "challenges_status_check" CHECK ("status" IN ('PUBLISHED','CLOSED'))
);
CREATE INDEX "challenges_status_deadline_idx" ON "challenges"("status","deadline");
CREATE TABLE "challenge_submissions" (
"id" TEXT NOT NULL,"challengeId" TEXT NOT NULL,"userId" TEXT NOT NULL,
"summary" VARCHAR(3000) NOT NULL,"projectUrl" VARCHAR(500),
"status" TEXT NOT NULL DEFAULT 'PENDING',"score" INTEGER,"feedback" VARCHAR(1000),
"reviewedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "challenge_submissions_pkey" PRIMARY KEY ("id"),
CONSTRAINT "challenge_submissions_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE,
CONSTRAINT "challenge_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
CONSTRAINT "challenge_submissions_status_check" CHECK ("status" IN ('PENDING','APPROVED','REJECTED')),
CONSTRAINT "challenge_submissions_score_check" CHECK ("score" IS NULL OR ("score" BETWEEN 0 AND 100))
);
CREATE UNIQUE INDEX "challenge_submissions_challengeId_userId_key" ON "challenge_submissions"("challengeId","userId");
CREATE INDEX "challenge_submissions_userId_status_idx" ON "challenge_submissions"("userId","status");
