-- AlterTable: add migration linkage and groupKey to Service (additive only)
ALTER TABLE "Service" ADD COLUMN "sourceCatalogItemId" TEXT;
ALTER TABLE "Service" ADD COLUMN "groupKey" TEXT;

-- CreateUniqueIndex: one Service per source CatalogItem (idempotent backfill)
CREATE UNIQUE INDEX "Service_sourceCatalogItemId_key" ON "Service"("sourceCatalogItemId");

-- CreateIndex: lookups by sourceCatalogItemId
CREATE INDEX "Service_sourceCatalogItemId_idx" ON "Service"("sourceCatalogItemId");
