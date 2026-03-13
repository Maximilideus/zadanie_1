-- Enforce: non-PENDING bookings must have serviceId, masterId, and scheduledAt set.
-- PENDING (wizard shells) may have NULLs; CONFIRMED/CANCELLED/COMPLETED must have full data.
ALTER TABLE "Booking"
ADD CONSTRAINT "booking_non_pending_requires_full_data"
CHECK (
  status = 'PENDING'
  OR (
    "serviceId" IS NOT NULL
    AND "masterId" IS NOT NULL
    AND "scheduledAt" IS NOT NULL
  )
);
