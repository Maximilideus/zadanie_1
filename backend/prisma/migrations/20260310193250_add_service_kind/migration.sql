-- CreateEnum
CREATE TYPE "ServiceKind" AS ENUM ('BUSINESS', 'LEGACY_TEMPLATE');

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "serviceKind" "ServiceKind" NOT NULL DEFAULT 'BUSINESS';
