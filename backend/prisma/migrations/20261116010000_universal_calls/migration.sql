CREATE TABLE "SiteCall" (
 "id" TEXT NOT NULL, "callerId" TEXT NOT NULL, "recipientId" TEXT NOT NULL,
 "mode" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'RINGING',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "answeredAt" TIMESTAMP(3), "endedAt" TIMESTAMP(3),
 CONSTRAINT "SiteCall_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SiteCallSignal" (
 "id" TEXT NOT NULL, "callId" TEXT NOT NULL, "senderId" TEXT NOT NULL,
 "recipientId" TEXT NOT NULL, "kind" TEXT NOT NULL, "payload" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SiteCallSignal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SiteCall_callerId_createdAt_idx" ON "SiteCall"("callerId","createdAt");
CREATE INDEX "SiteCall_recipientId_createdAt_idx" ON "SiteCall"("recipientId","createdAt");
CREATE INDEX "SiteCallSignal_callId_recipientId_createdAt_idx" ON "SiteCallSignal"("callId","recipientId","createdAt");
ALTER TABLE "SiteCall" ADD CONSTRAINT "SiteCall_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteCall" ADD CONSTRAINT "SiteCall_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteCallSignal" ADD CONSTRAINT "SiteCallSignal_callId_fkey" FOREIGN KEY ("callId") REFERENCES "SiteCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
