-- AlterTable
ALTER TABLE "Withdrawal" ADD COLUMN     "recipientCode" TEXT;

-- CreateTable
CREATE TABLE "TutorWallet" (
    "userId" TEXT NOT NULL,
    "availableKobo" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorWallet_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "PayoutAccount" (
    "userId" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "accountLast4" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "recipientCode" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutAccount_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "TutorWallet" ADD CONSTRAINT "TutorWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutAccount" ADD CONSTRAINT "PayoutAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
