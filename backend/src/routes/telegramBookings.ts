import { FastifyInstance, FastifyRequest } from "fastify"
import { z } from "zod"
import { prisma } from "../lib/prisma"
import { BookingService } from "../services/BookingService"
import {
  findOrCreateFromTelegram,
  customerHasPhoneByTelegramId,
} from "../services/CustomerService"

const createTelegramBookingSchema = z.object({
  telegramId: z.string().min(1),
  phone: z.string().optional(),
  telegramUsername: z.string().optional(),
  telegramFirstName: z.string().optional(),
  telegramLastName: z.string().optional(),
})

async function createTelegramBookingHandler(request: FastifyRequest) {
  const body = createTelegramBookingSchema.parse(request.body)
  const { telegramId, phone, telegramUsername, telegramFirstName, telegramLastName } = body

  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true },
  })
  if (!user) {
    throw new Error("NOT_FOUND")
  }

  const bookingService = new BookingService()
  const telegramUser = {
    username: telegramUsername,
    firstName: telegramFirstName,
    lastName: telegramLastName,
  }

  let customerId: string | undefined
  if (phone && phone.trim().length > 0) {
    const result = await findOrCreateFromTelegram(telegramId, phone, telegramUser)
    customerId = result.customerId
  } else if (await customerHasPhoneByTelegramId(telegramId)) {
    const result = await findOrCreateFromTelegram(telegramId, null, telegramUser)
    customerId = result.customerId
  }

  const booking = await bookingService.createBooking(user.id, {
    customerId,
    source: customerId ? "BOT" : undefined,
  })

  await prisma.user.update({
    where: { id: user.id },
    data: { state: "BOOKING_FLOW" },
  })

  request.log.info(
    { userId: user.id, bookingId: booking.id, customerId },
    "Telegram booking created, user state set to BOOKING_FLOW"
  )

  return booking
}

export async function telegramBookingsRoutes(app: FastifyInstance) {
  app.post("/bookings", createTelegramBookingHandler)
}
