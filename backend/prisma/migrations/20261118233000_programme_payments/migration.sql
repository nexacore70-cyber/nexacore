ALTER TABLE "ProgrammeApplication" ADD COLUMN "paidAt" TIMESTAMP(3);
CREATE TABLE "ProgrammePayment" (
 "id" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "reference" TEXT NOT NULL,
 "amountKobo" INTEGER NOT NULL, "currency" TEXT NOT NULL DEFAULT 'NGN',
 "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING', "verifiedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ProgrammePayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProgrammePayment_reference_key" ON "ProgrammePayment"("reference");
CREATE INDEX "ProgrammePayment_applicationId_status_idx" ON "ProgrammePayment"("applicationId", "status");
ALTER TABLE "ProgrammePayment" ADD CONSTRAINT "ProgrammePayment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "ProgrammeApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "ProgrammePaymentAllocation" (
 "id" TEXT NOT NULL, "paymentId" TEXT NOT NULL, "recipientId" TEXT NOT NULL,
 "kind" TEXT NOT NULL, "amountKobo" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ProgrammePaymentAllocation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProgrammePaymentAllocation_paymentId_kind_key" ON "ProgrammePaymentAllocation"("paymentId", "kind");
CREATE INDEX "ProgrammePaymentAllocation_recipientId_idx" ON "ProgrammePaymentAllocation"("recipientId");
ALTER TABLE "ProgrammePaymentAllocation" ADD CONSTRAINT "ProgrammePaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "ProgrammePayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
