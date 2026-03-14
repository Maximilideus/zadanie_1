import { FastifyInstance, FastifyRequest } from "fastify"
import { BookingService } from "../../services/BookingService"
import { cancelBookingByTelegramId, rescheduleBookingByTelegramId } from "../../modules/booking/booking.service"

const serviceBodySchema = {
  type: "object",
  required: ["telegramId", "serviceId"],
  properties: {
    telegramId: { type: "string", minLength: 1 },
    serviceId: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
} as const

const masterBodySchema = {
  type: "object",
  required: ["telegramId", "masterId"],
  properties: {
    telegramId: { type: "string", minLength: 1 },
    masterId: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
} as const

const timeBodySchema = {
  type: "object",
  required: ["telegramId", "scheduledAt"],
  properties: {
    telegramId: { type: "string", minLength: 1 },
    scheduledAt: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
} as const

const cancelBodySchema = {
  type: "object",
  required: ["telegramId", "bookingId"],
  properties: {
    telegramId: { type: "string", minLength: 1 },
    bookingId: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
} as const

const rescheduleBodySchema = {
  type: "object",
  required: ["telegramId", "bookingId", "masterId", "scheduledAt"],
  properties: {
    telegramId: { type: "string", minLength: 1 },
    bookingId: { type: "string", minLength: 1 },
    masterId: { type: "string", minLength: 1 },
    scheduledAt: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
} as const

type ServiceBody = { telegramId: string; serviceId: string }
type MasterBody = { telegramId: string; masterId: string }
type TimeBody = { telegramId: string; scheduledAt: string }
type CancelBody = { telegramId: string; bookingId: string }
type RescheduleBody = { telegramId: string; bookingId: string; masterId: string; scheduledAt: string }

async function setServiceHandler(request: FastifyRequest<{ Body: ServiceBody }>) {
  const { telegramId, serviceId } = request.body
  const bookingService = new BookingService()
  const booking = await bookingService.setServiceByTelegramId(telegramId, serviceId)
  request.log.info({ bookingId: booking.id, serviceId }, "Booking service set by telegramId")
  return booking
}

async function setMasterHandler(request: FastifyRequest<{ Body: MasterBody }>) {
  const { telegramId, masterId } = request.body
  const bookingService = new BookingService()
  const booking = await bookingService.setMasterByTelegramId(telegramId, masterId)
  request.log.info({ bookingId: booking.id, masterId }, "Booking master set by telegramId")
  return booking
}

async function setTimeHandler(request: FastifyRequest<{ Body: TimeBody }>) {
  const { telegramId, scheduledAt } = request.body
  const bookingService = new BookingService()
  const booking = await bookingService.setScheduledAtByTelegramId(telegramId, scheduledAt)
  request.log.info(
    { bookingId: booking.id, scheduledAt },
    "Booking time set, Telegram session reset to IDLE"
  )
  return booking
}

async function cancelBookingHandler(request: FastifyRequest<{ Body: CancelBody }>) {
  const { telegramId, bookingId } = request.body
  const booking = await cancelBookingByTelegramId(telegramId, bookingId)
  request.log.info({ bookingId, telegramId }, "Booking cancelled by telegramId")
  return booking
}

async function rescheduleBookingHandler(request: FastifyRequest<{ Body: RescheduleBody }>) {
  const { telegramId, bookingId, masterId, scheduledAt } = request.body
  const newBooking = await rescheduleBookingByTelegramId(telegramId, bookingId, masterId, scheduledAt)
  request.log.info(
    { oldBookingId: bookingId, newBookingId: newBooking.id, telegramId, masterId, scheduledAt },
    "Booking rescheduled by telegramId"
  )
  return newBooking
}

export async function bookingStepsRoutes(app: FastifyInstance) {
  app.post("/bookings/service", {
    schema: {
      body: serviceBodySchema,
      response: { 200: { type: "object", additionalProperties: true } },
    },
    handler: setServiceHandler,
  })
  app.post("/bookings/master", {
    schema: {
      body: masterBodySchema,
      response: { 200: { type: "object", additionalProperties: true } },
    },
    handler: setMasterHandler,
  })
  app.post("/bookings/time", {
    schema: {
      body: timeBodySchema,
      response: { 200: { type: "object", additionalProperties: true } },
    },
    handler: setTimeHandler,
  })
  app.post("/bookings/cancel", {
    schema: {
      body: cancelBodySchema,
      response: { 200: { type: "object", additionalProperties: true } },
    },
    handler: cancelBookingHandler,
  })
  app.post("/bookings/reschedule", {
    schema: {
      body: rescheduleBodySchema,
      response: { 200: { type: "object", additionalProperties: true } },
    },
    handler: rescheduleBookingHandler,
  })
}
