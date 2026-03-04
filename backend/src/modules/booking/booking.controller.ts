import { FastifyRequest } from "fastify"
import {
  bookingIdParamSchema,
  updateBookingStatusSchema,
  telegramIdParamSchema,
} from "./booking.schema"
import { updateBookingStatus, getBookingsByTelegramId } from "./booking.service"

export async function updateBookingStatusHandler(request: FastifyRequest) {
  const { id } = bookingIdParamSchema.parse(request.params)
  const { status } = updateBookingStatusSchema.parse(request.body)
  return updateBookingStatus(id, status)
}

export async function getUserBookingsHandler(request: FastifyRequest) {
  const { telegramId } = telegramIdParamSchema.parse(request.params)
  return getBookingsByTelegramId(telegramId)
}
