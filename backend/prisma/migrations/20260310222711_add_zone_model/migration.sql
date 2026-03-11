-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "zoneKey" TEXT NOT NULL,
    "labelRu" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Zone_zoneKey_key" ON "Zone"("zoneKey");
