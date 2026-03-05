import { prisma } from "../lib/prisma"

const INTERVAL_MS = 60 * 1000

export type ExpireJobLogger = {
  info: (bindings: object, message: string) => void
}

let running = false

async function runExpiry(log: ExpireJobLogger): Promise<void> {
  if (running) return
  running = true
  try {
    const now = new Date()
    const result = await prisma.booking.updateMany({
      where: {
        status: "PENDING",
        expiresAt: { lte: now },
      },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        expiresAt: null,
      },
    })
    if (result.count > 0) {
      log.info({ expiredCount: result.count }, "Expired PENDING bookings")
    }
  } finally {
    running = false
  }
}

export function startExpirePendingBookingsJob(log: ExpireJobLogger): NodeJS.Timeout {
  return setInterval(() => {
    runExpiry(log).catch((err) => {
      log.info({ err }, "Expire PENDING bookings job error")
    })
  }, INTERVAL_MS)
}
