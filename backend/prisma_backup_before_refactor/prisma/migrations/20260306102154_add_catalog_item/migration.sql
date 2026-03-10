-- CreateEnum
CREATE TYPE "CatalogCategory" AS ENUM ('LASER', 'WAX', 'ELECTRO', 'MASSAGE');

-- CreateEnum
CREATE TYPE "CatalogItemType" AS ENUM ('ZONE', 'OFFER', 'INFO');

-- CreateEnum
CREATE TYPE "CatalogGender" AS ENUM ('FEMALE', 'MALE', 'UNISEX');

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "category" "CatalogCategory" NOT NULL,
    "type" "CatalogItemType" NOT NULL,
    "gender" "CatalogGender",
    "groupKey" TEXT,
    "titleRu" TEXT NOT NULL,
    "subtitleRu" TEXT,
    "descriptionRu" TEXT,
    "price" INTEGER,
    "durationMin" INTEGER,
    "serviceId" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogItem_locationId_idx" ON "CatalogItem"("locationId");

-- CreateIndex
CREATE INDEX "CatalogItem_locationId_category_isVisible_sortOrder_idx" ON "CatalogItem"("locationId", "category", "isVisible", "sortOrder");

-- CreateIndex
CREATE INDEX "CatalogItem_locationId_category_groupKey_isVisible_sortOrde_idx" ON "CatalogItem"("locationId", "category", "groupKey", "isVisible", "sortOrder");

-- CreateIndex
CREATE INDEX "CatalogItem_serviceId_idx" ON "CatalogItem"("serviceId");

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
