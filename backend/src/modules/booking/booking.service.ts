import { Prisma } from "@prisma/client"
import { prisma } from "../../lib/prisma"
import type { BookingStatus, BookingAction } from "./booking.status.machine"
import { transition } from "./booking.status.machine"

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

function applyStatusTimestamps(
  newStatus: BookingStatus
): { status: string; confirmedAt?: Date; cancelledAt?: Date; completedAt?: Date } {
  const now = new Date()
  const data: {
    status: string
    confirmedAt?: Date
    cancelledAt?: Date
    completedAt?: Date
  } = { status: newStatus }
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
