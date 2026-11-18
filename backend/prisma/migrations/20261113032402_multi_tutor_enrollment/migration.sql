/*
  Warnings:

  - The primary key for the `CourseTutor` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "CourseTutor" DROP CONSTRAINT "CourseTutor_pkey",
ADD CONSTRAINT "CourseTutor_pkey" PRIMARY KEY ("courseId", "tutorId");

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "tutorId" TEXT;

-- CreateIndex
CREATE INDEX "enrollments_tutorId_idx" ON "enrollments"("tutorId");

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
