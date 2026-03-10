-- AlterEnum
ALTER TYPE "CatalogItemType" ADD VALUE 'PACKAGE';

-- CreateTable
CREATE TABLE "CatalogItemPackage" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CatalogItemPackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogItemPackage_packageId_idx" ON "CatalogItemPackage"("packageId");

-- CreateIndex
CREATE INDEX "CatalogItemPackage_itemId_idx" ON "CatalogItemPackage"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItemPackage_packageId_itemId_key" ON "CatalogItemPackage"("packageId", "itemId");

-- AddForeignKey
ALTER TABLE "CatalogItemPackage" ADD CONSTRAINT "CatalogItemPackage_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItemPackage" ADD CONSTRAINT "CatalogItemPackage_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
