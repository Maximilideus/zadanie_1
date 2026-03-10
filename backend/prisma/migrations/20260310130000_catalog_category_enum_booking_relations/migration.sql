-- AlterTable: Service.category from TEXT to CatalogCategory enum (nullable)
ALTER TABLE "Service" ALTER COLUMN "category" TYPE "CatalogCategory" USING (category::"CatalogCategory");

-- AlterTable: Package.category from TEXT to CatalogCategory enum (nullable)
ALTER TABLE "Package" ALTER COLUMN "category" TYPE "CatalogCategory" USING (category::"CatalogCategory");

-- AlterTable: Subscription.category from TEXT to CatalogCategory enum (required)
ALTER TABLE "Subscription" ALTER COLUMN "category" TYPE "CatalogCategory" USING (category::"CatalogCategory");

-- AddForeignKey: Booking.serviceId -> Service.id (schema preparation; booking behavior unchanged)
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: Booking.serviceId for lookups
CREATE INDEX "Booking_serviceId_idx" ON "Booking"("serviceId");
