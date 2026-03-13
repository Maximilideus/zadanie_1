import { Prisma, type BookingStatus as PrismaBookingStatus } from "@prisma/client"
import { DateTime } from "luxon"
import { prisma } from "../../lib/prisma"
import type { BookingStatus, BookingAction } from "./booking.status.machine"
import { transition } from "./booking.status.machine"
import { SALON_TIMEZONE } from "../../config/salon"
import { getAvailableSlots } from "../../services/AvailabilityService"
import { getServiceDisplayName } from "../../services/serviceDisplayName"

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
  let booking: { id: string; userId: string | null; status: string } | null = null
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
    userId: string | null
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

export async function rescheduleBookingByTelegramId(
  telegramId: string,
  currentBookingId: string,
  newMasterId: string,
  newScheduledAt: string
) {
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true },
  })
  if (!user) throw new Error("NOT_FOUND")

  const current = await prisma.booking.findFirst({
    where: { id: currentBookingId, userId: user.id },
    select: {
      id: true,
      userId: true,
      serviceId: true,
      locationId: true,
      status: true,
      scheduledAt: true,
      customerId: true,
      source: true,
    },
  })
  if (!current) throw new Error("NOT_FOUND")
  if (current.status !== "PENDING" && current.status !== "CONFIRMED") {
    throw new Error("BOOKING_NOT_RESCHEDULABLE")
  }
  if (!current.serviceId) throw new Error("BOOKING_MISSING_SERVICE")
  if (!current.scheduledAt) throw new Error("BOOKING_MISSING_SCHEDULED_AT")

  const now = new Date()
  const remainingMs = current.scheduledAt.getTime() - now.getTime()
  const cutoffMs = CANCEL_MIN_HOURS * 60 * 60 * 1000
  if (remainingMs <= cutoffMs) {
    throw new Error("RESCHEDULE_TOO_LATE")
  }

  const parsedScheduledAt = new Date(newScheduledAt)
  if (Number.isNaN(parsedScheduledAt.getTime())) {
    throw new Error("INVALID_SCHEDULED_AT")
  }

  const dateStr = DateTime.fromJSDate(parsedScheduledAt, { zone: SALON_TIMEZONE }).toFormat("yyyy-MM-dd")
  const { slots } = await getAvailableSlots({
    serviceId: current.serviceId,
    masterId: newMasterId,
    date: dateStr,
  })
  const slotSet = new Set(slots.map((s) => new Date(s).getTime()))
  if (!slotSet.has(parsedScheduledAt.getTime())) {
    throw new Error("SLOT_NOT_AVAILABLE")
  }

  let locationId = current.locationId
  if (!locationId) {
    const service = await prisma.service.findUnique({
      where: { id: current.serviceId },
      select: { locationId: true },
    })
    if (!service) throw new Error("NOT_FOUND")
    locationId = service.locationId
  }

  return prisma.$transaction(async (tx) => {
    const now = new Date()
    await tx.booking.update({
      where: { id: currentBookingId },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
      },
    })
    const newBooking = await tx.booking.create({
      data: {
        userId: current.userId ?? undefined,
        serviceId: current.serviceId,
        locationId,
        masterId: newMasterId,
        scheduledAt: parsedScheduledAt,
        status: "PENDING",
        customerId: current.customerId ?? undefined,
        source: current.source ?? undefined,
      },
      select: {
        id: true,
        userId: true,
        serviceId: true,
        masterId: true,
        locationId: true,
        status: true,
        scheduledAt: true,
        createdAt: true,
        updatedAt: true,
        confirmedAt: true,
        cancelledAt: true,
        completedAt: true,
      },
    })
    return newBooking
  })
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

/** Upcoming bookings for Telegram: scheduledAt > now, with service (displayName, zone, duration), master, status. */
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
  const [services, masters, catalogItems] = await Promise.all([
    prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true, durationMin: true, category: true, groupKey: true },
    }),
    prisma.user.findMany({
      where: { id: { in: masterIds } },
      select: { id: true, name: true },
    }),
    prisma.catalogItem.findMany({
      where: { serviceId: { in: serviceIds } },
      select: { serviceId: true, titleRu: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    }),
  ])
  const serviceById = Object.fromEntries(
    services.map((s) => [
      s.id,
      {
        name: s.name,
        displayName: getServiceDisplayName(s.name),
        durationMin: s.durationMin,
        isElectroTimePackage: s.category === "ELECTRO" && s.groupKey === "time",
      },
    ])
  )
  const zoneByServiceId: Record<string, string> = {}
  for (const item of catalogItems) {
    if (item.serviceId && !(item.serviceId in zoneByServiceId)) {
      zoneByServiceId[item.serviceId] = item.titleRu
    }
  }
  const masterByName = Object.fromEntries(masters.map((m) => [m.id, m.name]))
  return bookings.map((b) => {
    const svc = b.serviceId ? serviceById[b.serviceId] : null
    let zone = b.serviceId ? zoneByServiceId[b.serviceId] : undefined
    if (svc?.isElectroTimePackage && !zone && svc.durationMin != null) {
      zone = `${svc.durationMin} минут`
    }
    return {
      id: b.id,
      status: b.status,
      scheduledAt: b.scheduledAt,
      serviceId: b.serviceId ?? undefined,
      service: svc
        ? {
            name: svc.name,
            displayName: svc.displayName,
            zone: zone ?? undefined,
            durationMin: svc.durationMin,
            isElectroTimePackage: svc.isElectroTimePackage,
          }
        : { name: "—", displayName: "—", durationMin: undefined as number | undefined },
      masterName: b.masterId ? masterByName[b.masterId] ?? "—" : "—",
    }
  })
}
