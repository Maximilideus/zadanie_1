import { Prisma, type BookingStatus as PrismaBookingStatus } from "@prisma/client"
import { prisma } from "../../lib/prisma"
import type { BookingStatus, BookingAction } from "./booking.status.machine"
import { transition } from "./booking.status.machine"
import { SALON_TIMEZONE } from "../../config/salon"

const SCHEMA_SYNC_MESSAGE =
  "Database schema is not synchronized. Please run prisma migrate."

function handlePrismaError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
    throw new Error(SCHEMA_SYNC_MESSAGE)
  }
  throw e
}

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const bookingSelect = {
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  scheduledAt: true,
  confirmedAt: true,
  cancelledAt: true,
  completedAt: true,
} as const

function applyStatusTimestamps(newStatus: BookingStatus): {
  status: PrismaBookingStatus
  confirmedAt?: Date
  cancelledAt?: Date
  completedAt?: Date
} {
  const now = new Date()
  const data: {
    status: PrismaBookingStatus
    confirmedAt?: Date
    cancelledAt?: Date
    completedAt?: Date
  } = { status: newStatus as PrismaBookingStatus }
  if (newStatus === "CONFIRMED") data.confirmedAt = now
  if (newStatus === "CANCELLED") data.cancelledAt = now
  if (newStatus === "COMPLETED") data.completedAt = now
  return data
}

export async function createBooking(userId: string, tx?: PrismaTx) {
  const run = async (db: PrismaTx) => {
    try {
      const active = await db.booking.findFirst({
        where: {
          userId,
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      })
      if (active) throw new Error("ACTIVE_BOOKING_EXISTS")
      return db.booking.create({
        data: { userId, status: "PENDING" },
        select: {
          id: true,
          userId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          scheduledAt: true,
          confirmedAt: true,
          cancelledAt: true,
          completedAt: true,
        },
      })
    } catch (e) {
      if (e instanceof Error && e.message === "ACTIVE_BOOKING_EXISTS") throw e
      handlePrismaError(e)
    }
  }
  if (tx) return run(tx)
  return prisma.$transaction(run)
}

async function executeBookingAction(
  userId: string,
  bookingId: string,
  action: BookingAction
) {
  let booking: { id: string; userId: string; status: string } | null = null
  try {
    booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId },
      select: { id: true, userId: true, status: true },
    })
  } catch (e) {
    handlePrismaError(e)
  }
  if (!booking) throw new Error("NOT_FOUND")
  const newStatus = transition(booking.status as BookingStatus, action)
  const data = applyStatusTimestamps(newStatus)
  try {
    return await prisma.booking.update({
      where: { id: bookingId },
      data,
      select: bookingSelect,
    })
  } catch (e) {
    handlePrismaError(e)
  }
}

export async function confirmBooking(userId: string, bookingId: string) {
  return executeBookingAction(userId, bookingId, "CONFIRM")
}

export async function completeBooking(userId: string, bookingId: string) {
  return executeBookingAction(userId, bookingId, "COMPLETE")
}

export async function cancelBooking(userId: string, bookingId: string) {
  return executeBookingAction(userId, bookingId, "CANCEL")
}

const CANCEL_MIN_HOURS = 4

export async function cancelBookingByTelegramId(telegramId: string, bookingId: string) {
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true },
  })
  if (!user) throw new Error("NOT_FOUND")

  let booking: {
    id: string
    userId: string
    status: string
    scheduledAt: Date | null
  } | null = null
  try {
    booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true, status: true, scheduledAt: true },
    })
  } catch (e) {
    handlePrismaError(e)
  }
  if (!booking) throw new Error("NOT_FOUND")
  if (booking.userId !== user.id) throw new Error("NOT_FOUND")

  if (booking.status === "CANCELLED" || booking.status === "COMPLETED") {
    throw new Error("BOOKING_NOT_CANCELLABLE")
  }

  if (!booking.scheduledAt) {
    throw new Error("BOOKING_NOT_CANCELLABLE")
  }

  const now = new Date()
  const remainingMs = booking.scheduledAt.getTime() - now.getTime()
  const cutoffMs = CANCEL_MIN_HOURS * 60 * 60 * 1000
  const allowed = remainingMs > cutoffMs

  const fmtLocal = (d: Date) =>
    d.toLocaleString("ru-RU", { timeZone: SALON_TIMEZONE, dateStyle: "short", timeStyle: "medium" })

  // TODO: remove after verifying cancellation cutoff in production
  console.log("[cancel-check]", {
    scheduledAtUTC: booking.scheduledAt.toISOString(),
    scheduledAtSalon: fmtLocal(booking.scheduledAt),
    nowUTC: now.toISOString(),
    nowSalon: fmtLocal(now),
    remainingMs,
    remainingHours: +(remainingMs / 3_600_000).toFixed(2),
    cutoffMs,
    decision: allowed ? "ALLOW" : "DENY",
  })

  if (!allowed) {
    throw new Error("CANCELLATION_TOO_LATE")
  }

  return cancelBooking(user.id, bookingId)
}

export async function updateBookingStatus(bookingId: string, newStatus: BookingStatus) {
  let booking: { id: string; status: string } | null = null
  try {
    booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true },
    })
  } catch (e) {
    handlePrismaError(e)
  }
  if (!booking) throw new Error("NOT_FOUND")
  const current = booking.status as BookingStatus
  const actionByNewStatus: Record<string, BookingAction> = {
    CONFIRMED: "CONFIRM",
    CANCELLED: "CANCEL",
    COMPLETED: "COMPLETE",
  }
  const action = actionByNewStatus[newStatus]
  if (!action) throw new Error("INVALID_BOOKING_TRANSITION")
  transition(current, action)
  const data = applyStatusTimestamps(newStatus)
  try {
    return await prisma.booking.update({
      where: { id: bookingId },
      data,
      select: bookingSelect,
    })
  } catch (e) {
    handlePrismaError(e)
  }
}

export async function getBookingsByTelegramId(telegramId: string) {
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true },
  })
  if (!user) return []
  try {
    return await prisma.booking.findMany({
      where: { userId: user.id },
      select: { id: true, status: true, createdAt: true, scheduledAt: true },
      orderBy: { createdAt: "desc" },
    })
  } catch (e) {
    handlePrismaError(e)
  }
}

/** Upcoming bookings for Telegram: scheduledAt > now, with service and master names, limit 10. */
export async function getUpcomingBookingsByTelegramId(telegramId: string) {
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true },
  })
  if (!user) return []
  const now = new Date()
  const bookings = await prisma.booking.findMany({
    where: {
      userId: user.id,
      scheduledAt: { gt: now },
      status: { in: ["PENDING", "CONFIRMED"] },
      serviceId: { not: null },
      masterId: { not: null },
    },
    select: { id: true, status: true, scheduledAt: true, serviceId: true, masterId: true },
    orderBy: { scheduledAt: "asc" },
    take: 10,
  })
  if (bookings.length === 0) return []
  const serviceIds = [...new Set(bookings.map((b) => b.serviceId).filter(Boolean) as string[])]
  const masterIds = [...new Set(bookings.map((b) => b.masterId).filter(Boolean) as string[])]
  const [services, masters] = await Promise.all([
    prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true, durationMin: true },
    }),
    prisma.user.findMany({
      where: { id: { in: masterIds } },
      select: { id: true, name: true },
    }),
  ])
  const serviceById = Object.fromEntries(
    services.map((s) => [s.id, { name: s.name, durationMin: s.durationMin }])
  )
  const masterByName = Object.fromEntries(masters.map((m) => [m.id, m.name]))
  return bookings.map((b) => ({
    id: b.id,
    status: b.status,
    scheduledAt: b.scheduledAt,
    service: b.serviceId
      ? serviceById[b.serviceId] ?? { name: "—", durationMin: undefined }
      : { name: "—", durationMin: undefined },
    masterName: b.masterId ? masterByName[b.masterId] ?? "—" : "—",
  }))
}
