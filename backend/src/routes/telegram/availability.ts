import { FastifyInstance, FastifyRequest } from "fastify"
import { getAvailableSlots } from "../../services/AvailabilityService"

const querySchema = {
  type: "object",
  required: ["serviceId", "masterId", "date"],
  properties: {
    serviceId: { type: "string", minLength: 1 },
    masterId: { type: "string", minLength: 1 },
    date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
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

export async function availabilityRoutes(app: FastifyInstance) {
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
