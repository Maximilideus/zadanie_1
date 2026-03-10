-- AlterTable: add gender (CatalogGender, nullable) to Service, Package, Subscription
ALTER TABLE "Service" ADD COLUMN "gender" "CatalogGender";

ALTER TABLE "Package" ADD COLUMN "gender" "CatalogGender";

ALTER TABLE "Subscription" ADD COLUMN "gender" "CatalogGender";
