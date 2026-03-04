import { FastifyInstance } from "fastify"
import { updateBookingStatusHandler, getUserBookingsHandler } from "./booking.controller"

export async function bookingRoutes(app: FastifyInstance) {
  app.patch("/:id/status", updateBookingStatusHandler)
  app.get("/user/:telegramId", getUserBookingsHandler)
}
