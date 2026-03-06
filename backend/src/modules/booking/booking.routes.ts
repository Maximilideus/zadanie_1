import { FastifyInstance } from "fastify"
import {
  updateBookingStatusHandler,
  getUserBookingsHandler,
  getUpcomingBookingsHandler,
} from "./booking.controller"

export async function bookingRoutes(app: FastifyInstance) {
  app.patch("/:id/status", updateBookingStatusHandler)
  app.get("/user/:telegramId", getUserBookingsHandler)
  app.get("/user/:telegramId/upcoming", getUpcomingBookingsHandler)
}
