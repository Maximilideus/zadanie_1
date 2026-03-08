import { FastifyInstance, FastifyRequest } from "fastify"
import { prisma } from "../lib/prisma"

const UUID_PATTERN = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"

const querySchema = {
  type: "object",
  properties: {
    serviceId: { type: "string", pattern: UUID_PATTERN },
  },
  additionalProperties: false,
} as const

type Querystring = { serviceId?: string }

async function listMastersHandler(request: FastifyRequest<{ Querystring: Querystring }>) {
  const { serviceId } = request.query

  if (serviceId) {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true },
    })
    if (!service) {
      throw new Error("NOT_FOUND")
    }
    const masters = await prisma.user.findMany({
      where: {
        role: "MASTER",
        masterServices: { some: { serviceId } },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
    request.log.info({ serviceId, count: masters.length }, "Telegram masters listed by service")
    return { masters: masters.map((m) => ({ id: m.id, name: m.name })) }
  }

  const masters = await prisma.user.findMany({
    where: { role: "MASTER" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  request.log.info({ count: masters.length }, "Telegram masters listed (all)")
  return { masters: masters.map((m) => ({ id: m.id, name: m.name })) }
}

async function masterWorkingDaysHandler(
  request: FastifyRequest<{ Params: { masterId: string } }>
) {
  const { masterId } = request.params
  const rows = await prisma.workingHour.findMany({
    where: { masterId },
    select: { dayOfWeek: true },
  })
  const dayOfWeeks = [...new Set(rows.map((r) => r.dayOfWeek))].sort((a, b) => a - b)
  return { dayOfWeeks }
}

export async function telegramMastersRoutes(app: FastifyInstance) {
  app.get("/masters", {
    schema: {
      querystring: querySchema,
      response: {
        200: {
          type: "object",
          required: ["masters"],
          properties: {
            masters: {
              type: "array",
              items: {
                type: "object",
                required: ["id", "name"],
                properties: { id: { type: "string" }, name: { type: "string" } },
              },
            },
          },
        },
      },
    },
    handler: listMastersHandler,
  })

  app.get("/masters/:masterId/working-days", {
    schema: {
      params: {
        type: "object",
        required: ["masterId"],
        properties: { masterId: { type: "string", pattern: UUID_PATTERN } },
      },
      response: {
        200: {
          type: "object",
          required: ["dayOfWeeks"],
          properties: {
            dayOfWeeks: {
              type: "array",
              items: { type: "integer", minimum: 1, maximum: 7 },
            },
          },
        },
      },
    },
    handler: masterWorkingDaysHandler,
  })
}
