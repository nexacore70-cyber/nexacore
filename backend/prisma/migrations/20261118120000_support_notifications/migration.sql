ALTER TABLE "support_tickets" ADD COLUMN "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "support_tickets" ADD COLUMN "whatsappPhone" VARCHAR(20);
CREATE TABLE "support_notifications" (
  "id" TEXT NOT NULL, "recipientId" TEXT NOT NULL, "ticketId" TEXT NOT NULL,
  "kind" VARCHAR(40) NOT NULL, "title" VARCHAR(160) NOT NULL, "body" VARCHAR(500) NOT NULL,
  "readAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "support_notifications_recipientId_createdAt_idx" ON "support_notifications"("recipientId", "createdAt");
CREATE TABLE "support_deliveries" (
  "id" TEXT NOT NULL, "eventKey" VARCHAR(220) NOT NULL, "channel" VARCHAR(20) NOT NULL,
  "destination" VARCHAR(320) NOT NULL, "subject" VARCHAR(200), "body" TEXT NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lockedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3), "lastError" VARCHAR(500), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_deliveries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "support_deliveries_eventKey_key" ON "support_deliveries"("eventKey");
CREATE INDEX "support_deliveries_status_nextAttemptAt_idx" ON "support_deliveries"("status", "nextAttemptAt");
