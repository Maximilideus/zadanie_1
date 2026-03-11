-- AlterTable
ALTER TABLE "Package" ADD COLUMN     "showInBot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showOnWebsite" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "showInBot" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showOnWebsite" BOOLEAN NOT NULL DEFAULT true;
