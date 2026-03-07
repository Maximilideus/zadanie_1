import { FastifyInstance, FastifyRequest } from "fastify"
import { z } from "zod"
import { env } from "../../config/env"
import { authenticate } from "../../middlewares/auth.middleware"
import { requireRole } from "../../middlewares/requireRole"
import { prisma } from "../../lib/prisma"
import { updateBookingStatus } from "../booking/booking.service"
import type { BookingStatus } from "../booking/booking.status.machine"

const adminPreHandlers = [authenticate, requireRole("ADMIN")]

const loginBody = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
})

const bookingsQuery = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  masterId: z.string().uuid().optional(),
})

const statusPatchBody = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED", "COMPLETED"]),
})

export async function adminRoutes(app: FastifyInstance) {
  // ── Auth ──────────────────────────────────────────────────────

  app.post("/auth/login", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest, reply) => {
    const parsed = loginBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Неверный формат данных",
      })
    }

    const { email, password } = parsed.data

    if (email !== env.ADMIN_EMAIL || password !== env.ADMIN_PASSWORD) {
      return reply.status(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: "Неверный логин или пароль",
      })
    }

    const token = app.jwt.sign(
      { userId: "admin", role: "ADMIN" },
      { expiresIn: "8h" },
    )

    return { token }
  })

  app.get("/auth/me", {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply) => {
    const { userId, role } = request.user
    if (role !== "ADMIN") {
      return reply.status(403).send({
        statusCode: 403,
        error: "Forbidden",
        message: "Not an admin",
      })
    }
    return { userId, role, email: env.ADMIN_EMAIL }
  })

  // ── Bookings list ─────────────────────────────────────────────

  app.get("/bookings", {
    preHandler: adminPreHandlers,
  }, async (request: FastifyRequest, reply) => {
    const q = bookingsQuery.safeParse(request.query)
    if (!q.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Invalid query parameters",
      })
    }

    const { status, dateFrom, dateTo, masterId } = q.data

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (masterId) where.masterId = masterId
    if (dateFrom || dateTo) {
      const scheduled: Record<string, Date> = {}
      if (dateFrom) scheduled.gte = new Date(dateFrom)
      if (dateTo) {
        const end = new Date(dateTo)
        end.setDate(end.getDate() + 1)
        scheduled.lt = end
      }
      where.scheduledAt = scheduled
    }

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { scheduledAt: "desc" },
      take: 200,
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        createdAt: true,
        confirmedAt: true,
        cancelledAt: true,
        completedAt: true,
        userId: true,
        serviceId: true,
        masterId: true,
      },
    })

    const userIds = [...new Set(bookings.map((b) => b.userId))]
    const serviceIds = [...new Set(bookings.map((b) => b.serviceId).filter(Boolean) as string[])]
    const masterIds = [...new Set(bookings.map((b) => b.masterId).filter(Boolean) as string[])]

    const [users, services, masters] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, telegramId: true },
      }),
      serviceIds.length > 0
        ? prisma.service.findMany({
            where: { id: { in: serviceIds } },
            select: { id: true, name: true, durationMin: true, price: true },
          })
        : [],
      masterIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: masterIds } },
            select: { id: true, name: true },
          })
        : [],
    ])

    const userMap = Object.fromEntries(users.map((u) => [u.id, u]))
    const serviceMap = Object.fromEntries(services.map((s) => [s.id, s]))
    const masterMap = Object.fromEntries(masters.map((m) => [m.id, m]))

    const items = bookings.map((b) => {
      const user = userMap[b.userId]
      const service = b.serviceId ? serviceMap[b.serviceId] : null
      const master = b.masterId ? masterMap[b.masterId] : null

      return {
        id: b.id,
        status: b.status,
        scheduledAt: b.scheduledAt,
        createdAt: b.createdAt,
        confirmedAt: b.confirmedAt,
        cancelledAt: b.cancelledAt,
        completedAt: b.completedAt,
        client: user
          ? { name: user.name, email: user.email, telegramId: user.telegramId }
          : null,
        service: service
          ? { id: service.id, name: service.name, durationMin: service.durationMin, price: service.price }
          : null,
        master: master
          ? { id: master.id, name: master.name }
          : null,
      }
    })

    return { bookings: items }
  })

  // ── Update booking status ─────────────────────────────────────

  app.patch("/bookings/:id/status", {
    preHandler: adminPreHandlers,
  }, async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string }
    const body = statusPatchBody.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Invalid status value",
      })
    }

    try {
      const updated = await updateBookingStatus(id, body.data.status as BookingStatus)
      return { booking: updated }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ""
      if (msg === "NOT_FOUND") {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Запись не найдена",
        })
      }
      if (msg === "INVALID_BOOKING_TRANSITION") {
        return reply.status(422).send({
          statusCode: 422,
          error: "Unprocessable Entity",
          message: "Невозможный переход статуса",
        })
      }
      throw e
    }
  })

  // ── Masters list (for filters) ────────────────────────────────

  app.get("/masters", {
    preHandler: adminPreHandlers,
  }, async () => {
    const masters = await prisma.user.findMany({
      where: { role: "MASTER" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
    return { masters }
  })
}
