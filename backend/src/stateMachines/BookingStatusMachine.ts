const TERMINAL_STATUSES = ["COMPLETED", "CANCELLED"] as const
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
}

export class BookingStatusMachine {
  /**
   * Validates that the transition from currentStatus to nextStatus is allowed.
   * @throws Error with message "INVALID_BOOKING_TRANSITION" if the transition is invalid
   */
  validateTransition(currentStatus: string, nextStatus: string): void {
    const allowed = ALLOWED_TRANSITIONS[currentStatus]
    if (allowed === undefined) {
      throw new Error("INVALID_BOOKING_TRANSITION")
    }
    if (TERMINAL_STATUSES.includes(currentStatus as (typeof TERMINAL_STATUSES)[number])) {
      throw new Error("INVALID_BOOKING_TRANSITION")
    }
    if (!allowed.includes(nextStatus)) {
      throw new Error("INVALID_BOOKING_TRANSITION")
    }
  }
}
