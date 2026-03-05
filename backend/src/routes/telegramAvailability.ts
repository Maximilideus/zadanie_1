import { FastifyInstance, FastifyRequest } from "fastify"
import { getAvailableSlots } from "../services/AvailabilityService"

const UUID_PATTERN = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
const DATE_PATTERN = "^\\d{4}-\\d{2}-\\d{2}$"

const querySchema = {
  type: "object",
  required: ["serviceId", "masterId", "date"],
  properties: {
    serviceId: { type: "string", pattern: UUID_PATTERN },
    masterId: { type: "string", pattern: UUID_PATTERN },
    date: { type: "string", pattern: DATE_PATTERN },
  },
  additionalProperties: false,
} as const

type Querystring = {
  serviceId: string
  masterId: string
  date: string
}

async function availabilityHandler(request: FastifyRequest<{ Querystring: Querystring }>) {
  const { serviceId, masterId, date } = request.query
  const result = await getAvailableSlots({ serviceId, masterId, date })
  request.log.info(
    { serviceId, masterId, date, slotCount: result.slots.length },
    "Availability slots returned"
  )
  return result
}

export async function telegramAvailabilityRoutes(app: FastifyInstance) {
  app.get("/availability", {
    schema: {
      querystring: querySchema,
      response: {
        200: {
          type: "object",
          required: ["timezone", "slots"],
          properties: {
            timezone: { type: "string" },
            slots: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    handler: availabilityHandler,
  })
}
