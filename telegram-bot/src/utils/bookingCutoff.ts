/** Same as backend: cancel/reschedule allowed only if more than 4 hours until start. */
const CUTOFF_HOURS = 4
const CUTOFF_MS = CUTOFF_HOURS * 60 * 60 * 1000

/**
 * True if the booking start is more than 4 hours from now (cancel/reschedule allowed).
 * Used for UI (hiding buttons) and must match backend validation.
 */
export function canCancelOrReschedule(scheduledAt: Date | string): boolean {
  const start = typeof scheduledAt === "string" ? new Date(scheduledAt) : scheduledAt
  const now = Date.now()
  return start.getTime() - now > CUTOFF_MS
}
