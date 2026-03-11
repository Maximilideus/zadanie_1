-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "showInBot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showOnWebsite" BOOLEAN NOT NULL DEFAULT true;
