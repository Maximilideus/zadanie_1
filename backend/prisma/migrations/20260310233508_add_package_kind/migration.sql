-- CreateEnum
CREATE TYPE "PackageKind" AS ENUM ('MIGRATED', 'MANUAL');

-- AlterTable
ALTER TABLE "Package" ADD COLUMN     "packageKind" "PackageKind" NOT NULL DEFAULT 'MIGRATED';
