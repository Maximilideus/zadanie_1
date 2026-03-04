export const BOOKING_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

const ALLOWED: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  CANCELLED: [],
  COMPLETED: [],
}

export function validateBookingTransition(
  current: BookingStatus,
  next: BookingStatus
): void {
  const allowed = ALLOWED[current]
  if (!allowed || !allowed.includes(next)) {
    throw new Error("INVALID_BOOKING_TRANSITION")
  }
}
