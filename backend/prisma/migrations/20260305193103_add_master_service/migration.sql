-- CreateTable
CREATE TABLE "MasterService" (
    "id" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MasterService_masterId_idx" ON "MasterService"("masterId");

-- CreateIndex
CREATE INDEX "MasterService_serviceId_idx" ON "MasterService"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterService_masterId_serviceId_key" ON "MasterService"("masterId", "serviceId");

-- AddForeignKey
ALTER TABLE "MasterService" ADD CONSTRAINT "MasterService_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterService" ADD CONSTRAINT "MasterService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
