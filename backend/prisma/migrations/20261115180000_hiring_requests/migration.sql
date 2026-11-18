CREATE TABLE "hiring_requests" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" VARCHAR(3000) NOT NULL,
  "budgetKobo" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hiring_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hiring_requests_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "hiring_requests_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "hiring_requests_status_check" CHECK ("status" IN ('PENDING','ACCEPTED','DECLINED','CANCELLED')),
  CONSTRAINT "hiring_requests_budget_check" CHECK ("budgetKobo" BETWEEN 10000 AND 2000000000)
);
CREATE INDEX "hiring_requests_clientId_status_idx" ON "hiring_requests"("clientId","status");
CREATE INDEX "hiring_requests_providerId_status_idx" ON "hiring_requests"("providerId","status");
