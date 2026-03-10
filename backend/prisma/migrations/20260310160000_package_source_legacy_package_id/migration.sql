-- AlterTable: add sourceLegacyPackageId for idempotent normalized package creation (additive only)
ALTER TABLE "Package" ADD COLUMN "sourceLegacyPackageId" TEXT;

-- CreateUniqueIndex: one normalized Package per legacy CatalogItem PACKAGE
CREATE UNIQUE INDEX "Package_sourceLegacyPackageId_key" ON "Package"("sourceLegacyPackageId");

-- CreateIndex
CREATE INDEX "Package_sourceLegacyPackageId_idx" ON "Package"("sourceLegacyPackageId");
