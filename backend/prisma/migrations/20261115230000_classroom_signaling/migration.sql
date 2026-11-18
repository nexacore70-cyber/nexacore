CREATE TABLE "ClassroomSignal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cohortId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ClassroomSignal_cohortId_recipientId_createdAt_idx" ON "ClassroomSignal"("cohortId","recipientId","createdAt");
