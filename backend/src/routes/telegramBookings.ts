import { FastifyInstance, FastifyRequest } from "fastify"
import { z } from "zod"
import { prisma } from "../lib/prisma"
import { BookingService } from "../services/BookingService"
import { findOrCreateFromTelegram } from "../services/CustomerService"
import { getOrCreateTelegramSession } from "../modules/telegram/telegram-session.service"

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

  const bookingService = new BookingService()
  const telegramUser = {
    username: telegramUsername,
    firstName: telegramFirstName,
    lastName: telegramLastName,
  }

  // Phase 5: Customer only; no User required
  const phoneVal = phone?.trim() && phone.trim().length > 0 ? phone.trim() : null
  const { customerId } = await findOrCreateFromTelegram(telegramId, phoneVal, telegramUser)

  const booking = await bookingService.createBookingForCustomer(customerId, { source: "BOT" })

  await getOrCreateTelegramSession(telegramId)
  await prisma.telegramSession.update({
    where: { telegramId },
    data: { state: "BOOKING_FLOW" },
  })

  request.log.info(
    { bookingId: booking.id, customerId },
    "Telegram booking created, session state set to BOOKING_FLOW"
  )

  return booking
}

export async function telegramBookingsRoutes(app: FastifyInstance) {
  app.post("/bookings", createTelegramBookingHandler)
}
