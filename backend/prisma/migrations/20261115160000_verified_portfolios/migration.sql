CREATE TABLE "portfolio_profiles" (
"id" TEXT NOT NULL, "userId" TEXT NOT NULL, "headline" VARCHAR(120) NOT NULL DEFAULT '',
"bio" VARCHAR(2000) NOT NULL DEFAULT '', "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
"availableForHire" BOOLEAN NOT NULL DEFAULT false,
"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "portfolio_profiles_pkey" PRIMARY KEY ("id"),
CONSTRAINT "portfolio_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "portfolio_profiles_userId_key" ON "portfolio_profiles"("userId");
CREATE TABLE "portfolio_projects" (
"id" TEXT NOT NULL, "userId" TEXT NOT NULL,"title" VARCHAR(120) NOT NULL,
"description" VARCHAR(2000) NOT NULL,"projectUrl" VARCHAR(500),
"challengeSubmissionId" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "portfolio_projects_pkey" PRIMARY KEY ("id"),
CONSTRAINT "portfolio_projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "portfolio_projects_challengeSubmissionId_key" ON "portfolio_projects"("challengeSubmissionId");
CREATE INDEX "portfolio_projects_userId_createdAt_idx" ON "portfolio_projects"("userId","createdAt");
