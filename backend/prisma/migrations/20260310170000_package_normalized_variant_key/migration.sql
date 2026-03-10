-- AlterTable: add normalizedVariantKey for variant identity (additive only)
ALTER TABLE "Package" ADD COLUMN "normalizedVariantKey" TEXT;

-- Drop old single-column unique so we can use composite (sourceLegacyPackageId, normalizedVariantKey)
DROP INDEX IF EXISTS "Package_sourceLegacyPackageId_key";

-- CreateUniqueIndex: one normalized Package per (legacy source, variant key)
CREATE UNIQUE INDEX "Package_sourceLegacyPackageId_normalizedVariantKey_key" ON "Package"("sourceLegacyPackageId", "normalizedVariantKey");
