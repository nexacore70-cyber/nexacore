ALTER TABLE "ProjectContract" ADD COLUMN "hiringRequestId" TEXT;
CREATE UNIQUE INDEX "ProjectContract_hiringRequestId_key" ON "ProjectContract"("hiringRequestId");
ALTER TABLE "ProjectContract" ADD CONSTRAINT "ProjectContract_hiringRequestId_fkey" FOREIGN KEY ("hiringRequestId") REFERENCES "hiring_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
