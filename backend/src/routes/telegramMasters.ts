import { FastifyInstance, FastifyRequest } from "fastify"
import { DateTime } from "luxon"
import { prisma } from "../lib/prisma"
import { SALON_TIMEZONE } from "../config/salon"

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
        isActive: true,
        masterServices: { some: { serviceId } },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
    request.log.info({ serviceId, count: masters.length }, "Telegram masters listed by service")
    return { masters: masters.map((m) => ({ id: m.id, name: m.name })) }
  }

  const masters = await prisma.user.findMany({
    where: { role: "MASTER", isActive: true },
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

const DATE_STR_PATTERN = "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"
const blockedDatesQuerySchema = {
  type: "object",
  properties: {
    from: { type: "string", pattern: DATE_STR_PATTERN },
    to: { type: "string", pattern: DATE_STR_PATTERN },
  },
  additionalProperties: false,
} as const

type BlockedDatesQuery = { from?: string; to?: string }

async function masterBlockedDatesHandler(
  request: FastifyRequest<{ Params: { masterId: string }; Querystring: BlockedDatesQuery }>
) {
  const { masterId } = request.params
  const now = DateTime.now().setZone(SALON_TIMEZONE)
  const fromStr = request.query.from ?? now.plus({ days: 1 }).toFormat("yyyy-MM-dd")
  const toStr = request.query.to ?? now.plus({ days: 60 }).toFormat("yyyy-MM-dd")
  const fromStart = DateTime.fromISO(fromStr, { zone: SALON_TIMEZONE }).startOf("day").toJSDate()
  const toEnd = DateTime.fromISO(toStr, { zone: SALON_TIMEZONE }).endOf("day").toJSDate()

  const rows = await prisma.exception.findMany({
    where: {
      masterId,
      OR: [
        { dateTo: null, date: { gte: fromStart, lte: toEnd } },
        {
          dateTo: { not: null, gte: fromStart },
          date: { lte: toEnd },
        },
      ],
    },
    select: { date: true, dateTo: true },
  })

  const set = new Set<string>()
  for (const r of rows) {
    const start = DateTime.fromJSDate(r.date, { zone: SALON_TIMEZONE }).startOf("day")
    const end = r.dateTo
      ? DateTime.fromJSDate(r.dateTo, { zone: SALON_TIMEZONE }).startOf("day")
      : start
    let d = start
    while (d <= end) {
      const key = d.toFormat("yyyy-MM-dd")
      if (key >= fromStr && key <= toStr) set.add(key)
      d = d.plus({ days: 1 })
    }
  }
  const dates = [...set].sort()
  return { dates }
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

  app.get("/masters/:masterId/blocked-dates", {
    schema: {
      params: {
        type: "object",
        required: ["masterId"],
        properties: { masterId: { type: "string", pattern: UUID_PATTERN } },
      },
      querystring: blockedDatesQuerySchema,
      response: {
        200: {
          type: "object",
          required: ["dates"],
          properties: {
            dates: {
              type: "array",
              items: { type: "string", pattern: DATE_STR_PATTERN },
            },
          },
        },
      },
    },
    handler: masterBlockedDatesHandler,
  })
}
