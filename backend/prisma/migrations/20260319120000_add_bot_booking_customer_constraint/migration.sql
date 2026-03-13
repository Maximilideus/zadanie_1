-- Enforce: if Booking.source = 'BOT' then Booking.customerId must not be null.
-- Prevents Telegram-created bookings without a linked Customer.
ALTER TABLE "Booking"
ADD CONSTRAINT "booking_bot_requires_customer"
CHECK (
  source <> 'BOT'
  OR "customerId" IS NOT NULL
);
