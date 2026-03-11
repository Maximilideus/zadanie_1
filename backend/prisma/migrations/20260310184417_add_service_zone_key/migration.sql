-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "zoneKey" TEXT;

-- CreateIndex
CREATE INDEX "Service_zoneKey_idx" ON "Service"("zoneKey");
