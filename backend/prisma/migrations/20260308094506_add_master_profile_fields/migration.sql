-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isVisibleOnWebsite" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "publicTitleRu" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;
