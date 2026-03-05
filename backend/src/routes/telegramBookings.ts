import { FastifyInstance, FastifyRequest } from "fastify"
import { z } from "zod"
import { prisma } from "../lib/prisma"
import { BookingService } from "../services/BookingService"

const createTelegramBookingSchema = z.object({
  telegramId: z.string().min(1),
})

async function createTelegramBookingHandler(request: FastifyRequest) {
  const { telegramId } = createTelegramBookingSchema.parse(request.body)

  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true },
  })
  if (!user) {
    throw new Error("NOT_FOUND")
  }

  const bookingService = new BookingService()
  const booking = await bookingService.createBooking(user.id)

  await prisma.user.update({
    where: { id: user.id },
    data: { state: "BOOKING_FLOW" },
  })

  request.log.info({ userId: user.id, bookingId: booking.id }, "Telegram booking created, user state set to BOOKING_FLOW")
  return booking
}

export async function telegramBookingsRoutes(app: FastifyInstance) {
  app.post("/bookings", createTelegramBookingHandler)
}
