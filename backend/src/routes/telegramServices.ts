import { FastifyInstance, FastifyRequest } from "fastify"
import { prisma } from "../lib/prisma"

const UUID_PATTERN = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"

const querySchema = {
  type: "object",
  properties: {
    locationId: { type: "string", pattern: UUID_PATTERN },
  },
  additionalProperties: false,
} as const

type Querystring = { locationId?: string }

const serviceItemSchema = {
  type: "object",
  required: ["id", "name", "durationMin", "price", "locationId"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    durationMin: { type: "number" },
    price: { type: "number" },
    locationId: { type: "string" },
  },
} as const

async function listServicesHandler(request: FastifyRequest<{ Querystring: Querystring }>) {
  const { locationId } = request.query

  const services = await prisma.service.findMany({
    where: locationId ? { locationId } : undefined,
    select: { id: true, name: true, durationMin: true, price: true, locationId: true },
    orderBy: { name: "asc" },
  })

  request.log.info(
    locationId ? { locationId, count: services.length } : { count: services.length },
    "Telegram services listed"
  )
  return { services }
}

export async function telegramServicesRoutes(app: FastifyInstance) {
  app.get("/services", {
    schema: {
      querystring: querySchema,
      response: {
        200: {
          type: "object",
          required: ["services"],
          properties: {
            services: {
              type: "array",
              items: serviceItemSchema,
            },
          },
        },
      },
    },
    handler: listServicesHandler,
  })
}
