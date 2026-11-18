ALTER TABLE "ProgrammeCohort" ADD COLUMN "proposedFeeKobo" INTEGER, ADD COLUMN "approvedFeeKobo" INTEGER, ADD COLUMN "feeApprovalStatus" TEXT NOT NULL DEFAULT 'PENDING', ADD COLUMN "feeApprovedAt" TIMESTAMP(3), ADD COLUMN "feeApprovedById" TEXT;
CREATE INDEX "ProgrammeCohort_feeApprovalStatus_idx" ON "ProgrammeCohort"("feeApprovalStatus");
