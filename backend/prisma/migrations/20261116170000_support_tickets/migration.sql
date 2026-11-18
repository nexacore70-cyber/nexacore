CREATE TABLE "support_tickets" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "subject" VARCHAR(160) NOT NULL,
 "category" VARCHAR(40) NOT NULL, "description" TEXT NOT NULL,
 "status" VARCHAR(24) NOT NULL DEFAULT 'OPEN', "adminReply" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "support_tickets_userId_createdAt_idx" ON "support_tickets"("userId", "createdAt");
CREATE INDEX "support_tickets_status_createdAt_idx" ON "support_tickets"("status", "createdAt");
