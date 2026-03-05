import { Prisma, type BookingStatus as PrismaBookingStatus } from "@prisma/client"
import { prisma } from "../lib/prisma"
import { BookingStatusMachine } from "../stateMachines/BookingStatusMachine"

const SCHEMA_SYNC_MESSAGE =
  "Database schema is not synchronized. Please run prisma migrate."

const PENDING_TTL_HOURS = 12

const bookingSelect = {
  id: true,
  userId: true,
  serviceId: true,
  masterId: true,
  locationId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  scheduledAt: true,
  confirmedAt: true,
  cancelledAt: true,
  completedAt: true,
  expiresAt: true,
} as const

function handlePrismaError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
    throw new Error(SCHEMA_SYNC_MESSAGE)
  }
  throw e
}

export class BookingService {
  private readonly statusMachine = new BookingStatusMachine()

  async createBooking(userId: string) {
    const now = new Date()
    const active = await prisma.booking.findFirst({
      where: {
        userId,
        OR: [
          { status: "CONFIRMED" },
          { status: "PENDING", expiresAt: { gt: now } },
        ],
      },
    })
    if (active) {
      throw new Error("ACTIVE_BOOKING_EXISTS")
    }
    const expiresAt = new Date(now.getTime() + PENDING_TTL_HOURS * 60 * 60 * 1000)
    try {
      return await prisma.booking.create({
        data: { userId, status: "PENDING", expiresAt },
        select: bookingSelect,
      })
    } catch (e) {
      handlePrismaError(e)
    }
  }

  async confirmBooking(bookingId: string) {
    return this.updateBookingStatus(bookingId, "CONFIRMED", {
      confirmedAt: new Date(),
      expiresAt: null,
    })
  }

  async cancelBooking(bookingId: string) {
    return this.updateBookingStatus(bookingId, "CANCELLED", {
      cancelledAt: new Date(),
      expiresAt: null,
    })
  }

  async completeBooking(bookingId: string) {
    return this.updateBookingStatus(bookingId, "COMPLETED", {
      completedAt: new Date(),
      expiresAt: null,
    })
  }

  private async getPendingBookingByTelegramId(telegramId: string) {
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true },
    })
    if (!user) throw new Error("NOT_FOUND")
    const now = new Date()
    const booking = await prisma.booking.findFirst({
      where: {
        userId: user.id,
        status: "PENDING",
        expiresAt: { gt: now },
      },
      select: { id: true },
    })
    if (!booking) throw new Error("NO_PENDING_BOOKING")
    return { userId: user.id, bookingId: booking.id }
  }

  private async getPendingBookingWithService(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, serviceId: true },
    })
    if (!booking) throw new Error("NOT_FOUND")
    return booking
  }

  async setServiceByTelegramId(telegramId: string, serviceId: string) {
    const { bookingId } = await this.getPendingBookingByTelegramId(telegramId)
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, locationId: true },
    })
    if (!service) throw new Error("NOT_FOUND")
    try {
      return await prisma.booking.update({
        where: { id: bookingId },
        data: { serviceId, locationId: service.locationId, confirmedAt: null },
        select: bookingSelect,
      })
    } catch (e) {
      handlePrismaError(e)
    }
  }

  async setMasterByTelegramId(telegramId: string, masterId: string) {
    const { bookingId } = await this.getPendingBookingByTelegramId(telegramId)
    const booking = await this.getPendingBookingWithService(bookingId)
    if (!booking.serviceId) {
      throw new Error("SELECT_SERVICE_FIRST")
    }
    const master = await prisma.user.findUnique({
      where: { id: masterId },
      select: { role: true },
    })
    if (!master || master.role !== "MASTER") {
      throw new Error("MASTER_CANNOT_PERFORM_SERVICE")
    }
    const link = await prisma.masterService.findUnique({
      where: {
        masterId_serviceId: { masterId, serviceId: booking.serviceId },
      },
    })
    if (!link) {
      throw new Error("MASTER_CANNOT_PERFORM_SERVICE")
    }
    try {
      return await prisma.booking.update({
        where: { id: bookingId },
        data: { masterId, confirmedAt: null },
        select: bookingSelect,
      })
    } catch (e) {
      handlePrismaError(e)
    }
  }

  async setScheduledAtByTelegramId(telegramId: string, scheduledAtIso: string) {
    const parsed = new Date(scheduledAtIso)
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("INVALID_SCHEDULED_AT")
    }
    const { userId, bookingId } = await this.getPendingBookingByTelegramId(telegramId)
    try {
      return await prisma.$transaction(async (tx) => {
        const updated = await tx.booking.update({
          where: { id: bookingId },
          data: { scheduledAt: parsed, confirmedAt: null },
          select: bookingSelect,
        })
        await tx.user.update({
          where: { id: userId },
          data: { state: "IDLE" },
        })
        return updated
      })
    } catch (e) {
      handlePrismaError(e)
    }
  }

  private async updateBookingStatus(
    bookingId: string,
    nextStatus: PrismaBookingStatus,
    timestamps: {
      confirmedAt?: Date
      cancelledAt?: Date
      completedAt?: Date
      expiresAt?: null
    }
  ) {
    let booking: { id: string; status: PrismaBookingStatus } | null = null
    try {
      booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, status: true },
      })
    } catch (e) {
      handlePrismaError(e)
    }
    if (!booking) throw new Error("NOT_FOUND")

    this.statusMachine.validateTransition(booking.status, nextStatus)

    try {
      return await prisma.booking.update({
        where: { id: bookingId },
        data: { status: nextStatus, expiresAt: null, ...timestamps },
        select: bookingSelect,
      })
    } catch (e) {
      handlePrismaError(e)
    }
  }
}
