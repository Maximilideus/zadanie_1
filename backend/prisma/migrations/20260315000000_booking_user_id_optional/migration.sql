-- AlterTable: make Booking.userId optional so client-linked bookings can exist without User (Phase 1: Customer as client source of truth).
ALTER TABLE "Booking" ALTER COLUMN "userId" DROP NOT NULL;
