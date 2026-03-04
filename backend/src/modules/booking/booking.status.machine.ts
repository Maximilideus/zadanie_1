export const BOOKING_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export const BOOKING_ACTIONS = ["CONFIRM", "COMPLETE", "CANCEL"] as const
export type BookingAction = (typeof BOOKING_ACTIONS)[number]

const transitions: Record<
  Exclude<BookingStatus, "COMPLETED" | "CANCELLED">,
  Partial<Record<BookingAction, BookingStatus>>
> = {
  PENDING: { CONFIRM: "CONFIRMED", CANCEL: "CANCELLED" },
  CONFIRMED: { COMPLETE: "COMPLETED", CANCEL: "CANCELLED" },
}

export function transition(current: BookingStatus, action: BookingAction): BookingStatus {
  if (current === "COMPLETED" || current === "CANCELLED") {
    throw new Error("INVALID_BOOKING_TRANSITION")
  }
  const next = transitions[current]?.[action]
  if (next === undefined) {
    throw new Error("INVALID_BOOKING_TRANSITION")
  }
  return next
}
