-- AlterTable
ALTER TABLE "WorkingHour" ADD COLUMN "masterId" TEXT;

-- CreateIndex
CREATE INDEX "WorkingHour_masterId_dayOfWeek_idx" ON "WorkingHour"("masterId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "WorkingHour" ADD CONSTRAINT "WorkingHour_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
