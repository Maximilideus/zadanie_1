import { FastifyInstance, FastifyRequest } from "fastify"
import { z } from "zod"
import { DateTime } from "luxon"
import { env } from "../../config/env"
import { SALON_TIMEZONE } from "../../config/salon"
import { authenticate } from "../../middlewares/auth.middleware"
import { requireRole } from "../../middlewares/requireRole"
import { prisma } from "../../lib/prisma"
import { updateBookingStatus } from "../booking/booking.service"
import type { BookingStatus } from "../booking/booking.status.machine"
import { sendBookingStatusNotification } from "../../services/bookingNotifications"

const DATE_YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/
function parseSalonDate(dateStr: string): Date {
  const dt = DateTime.fromISO(dateStr, { zone: SALON_TIMEZONE }).startOf("day")
  if (!dt.isValid) throw new Error("INVALID_DATE")
  return dt.toJSDate()
}
function parseSalonDateEnd(dateStr: string): Date {
  const dt = DateTime.fromISO(dateStr, { zone: SALON_TIMEZONE }).endOf("day")
  if (!dt.isValid) throw new Error("INVALID_DATE")
  return dt.toJSDate()
}

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

const catalogPatchBody = z.object({
  titleRu: z.string().min(1, "titleRu не может быть пустым").optional(),
  descriptionRu: z.string().nullable().optional(),
  price: z.number().int().min(0, "price >= 0").nullable().optional(),
  durationMin: z.number().int().min(1, "durationMin > 0").nullable().optional(),
  isVisible: z.boolean().optional(),
  sortOrder: z.number().int().min(0, "sortOrder >= 0").optional(),
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

    const newStatus = body.data.status as BookingStatus

    try {
      const updated = await updateBookingStatus(id, newStatus)

      // Best-effort Telegram notification — never blocks admin response
      prisma.booking.findUnique({
        where: { id },
        select: {
          scheduledAt: true,
          user: { select: { telegramId: true } },
          serviceId: true,
          masterId: true,
        },
      }).then(async (booking) => {
        if (!booking?.user?.telegramId) return
        const [service, master] = await Promise.all([
          booking.serviceId
            ? prisma.service.findUnique({ where: { id: booking.serviceId }, select: { name: true } })
            : null,
          booking.masterId
            ? prisma.user.findUnique({ where: { id: booking.masterId }, select: { name: true } })
            : null,
        ])
        await sendBookingStatusNotification({
          telegramId: booking.user.telegramId,
          newStatus,
          serviceName: service?.name ?? null,
          masterName: master?.name ?? null,
          scheduledAt: booking.scheduledAt,
        })
      }).catch((err) => {
        console.error("[admin] Booking notification error (non-fatal):", err)
      })

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

  // ── Masters ──────────────────────────────────────────────────

  const masterSelect = {
    id: true,
    name: true,
    email: true,
    photoUrl: true,
    publicTitleRu: true,
    isActive: true,
    isVisibleOnWebsite: true,
    sortOrder: true,
    masterServices: { select: { serviceId: true } },
    workingHours: { select: { id: true, dayOfWeek: true, startTime: true, endTime: true } },
    exceptions: { select: { id: true, date: true, dateTo: true } },
  } as const

  const masterCreateBody = z.object({
    name: z.string().min(1, "Имя обязательно"),
    email: z.string().email("Невалидный email"),
    photoUrl: z.string().nullable().optional(),
    publicTitleRu: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    isVisibleOnWebsite: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    serviceIds: z.array(z.string().uuid()).optional(),
  })

  const workingHourRow = z.object({
    dayOfWeek: z.number().int().min(1, "dayOfWeek 1–7").max(7),
    startTime: z.string().regex(/^\d{1,2}:\d{2}$/, "startTime HH:MM"),
    endTime: z.string().regex(/^\d{1,2}:\d{2}$/, "endTime HH:MM"),
  }).refine((r) => r.startTime < r.endTime, { message: "startTime должен быть раньше endTime", path: ["endTime"] })

  const exceptionDayOff = z.object({
    type: z.literal("DAY_OFF"),
    date: z.string().regex(DATE_YYYY_MM_DD),
  })
  const exceptionVacation = z.object({
    type: z.literal("VACATION"),
    dateFrom: z.string().regex(DATE_YYYY_MM_DD),
    dateTo: z.string().regex(DATE_YYYY_MM_DD),
  }).refine((r) => r.dateFrom <= r.dateTo, { message: "dateFrom <= dateTo", path: ["dateTo"] })
  const exceptionRow = z.discriminatedUnion("type", [exceptionDayOff, exceptionVacation])

  const masterPatchBody = z.object({
    name: z.string().min(1, "Имя обязательно").optional(),
    photoUrl: z.string().nullable().optional(),
    publicTitleRu: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    isVisibleOnWebsite: z.boolean().optional(),
    sortOrder: z.number().int().min(0, "sortOrder >= 0").optional(),
    serviceIds: z.array(z.string().uuid()).optional(),
    workingHours: z.array(workingHourRow).optional(),
    exceptions: z.array(exceptionRow).optional(),
  })

  function flattenMaster(m: {
    masterServices: { serviceId: string }[]
    exceptions?: { id: string; date: Date; dateTo: Date | null }[]
    [key: string]: unknown
  }) {
    const { masterServices, exceptions, ...rest } = m
    return {
      ...rest,
      serviceIds: masterServices.map((ms) => ms.serviceId),
      exceptions: (exceptions ?? []).map((e) => ({
        id: e.id,
        date: DateTime.fromJSDate(e.date, { zone: SALON_TIMEZONE }).toFormat("yyyy-MM-dd"),
        dateTo: e.dateTo
          ? DateTime.fromJSDate(e.dateTo, { zone: SALON_TIMEZONE }).toFormat("yyyy-MM-dd")
          : null,
      })),
    }
  }

  app.get("/masters", {
    preHandler: adminPreHandlers,
  }, async () => {
    const raw = await prisma.user.findMany({
      where: { role: "MASTER" },
      select: masterSelect,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })
    return { masters: raw.map(flattenMaster) }
  })

  app.get("/services", {
    preHandler: adminPreHandlers,
  }, async () => {
    const services = await prisma.service.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, durationMin: true, price: true },
    })
    return { services }
  })

  app.post("/masters", {
    preHandler: adminPreHandlers,
  }, async (request: FastifyRequest, reply) => {
    const body = masterCreateBody.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: body.error.issues.map((i) => i.message).join("; "),
      })
    }

    const existing = await prisma.user.findUnique({ where: { email: body.data.email } })
    if (existing) {
      return reply.status(409).send({
        statusCode: 409,
        error: "Conflict",
        message: "Пользователь с таким email уже существует",
      })
    }

    const bcrypt = await import("bcrypt")
    const randomPassword = crypto.randomUUID()
    const hashed = await bcrypt.default.hash(randomPassword, 10)

    const location = await prisma.location.findFirst()

    const { serviceIds, ...profileData } = body.data

    const master = await prisma.user.create({
      data: {
        name: profileData.name,
        email: profileData.email,
        password: hashed,
        role: "MASTER",
        state: "IDLE",
        locationId: location?.id ?? null,
        photoUrl: profileData.photoUrl ?? null,
        publicTitleRu: profileData.publicTitleRu ?? null,
        isActive: profileData.isActive ?? true,
        isVisibleOnWebsite: profileData.isVisibleOnWebsite ?? true,
        sortOrder: profileData.sortOrder ?? 0,
        masterServices: serviceIds?.length
          ? { create: serviceIds.map((sid) => ({ serviceId: sid })) }
          : undefined,
      },
      select: masterSelect,
    })

    return reply.status(201).send({ master: flattenMaster(master) })
  })

  app.patch("/masters/:id", {
    preHandler: adminPreHandlers,
  }, async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string }
    const body = masterPatchBody.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: body.error.issues.map((i) => i.message).join("; "),
      })
    }

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing || existing.role !== "MASTER") {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Мастер не найден",
      })
    }

    const { serviceIds, workingHours: workingHoursPayload, exceptions: exceptionsPayload, ...profileFields } = body.data

    if (exceptionsPayload !== undefined) {
      await prisma.exception.deleteMany({ where: { masterId: id } })
      for (const ex of exceptionsPayload) {
        if (ex.type === "DAY_OFF") {
          await prisma.exception.create({
            data: {
              masterId: id,
              date: parseSalonDate(ex.date),
              dateTo: null,
              startAt: null,
              endAt: null,
            },
          })
        } else {
          await prisma.exception.create({
            data: {
              masterId: id,
              date: parseSalonDate(ex.dateFrom),
              dateTo: parseSalonDateEnd(ex.dateTo),
              startAt: null,
              endAt: null,
            },
          })
        }
      }
    }

    if (serviceIds !== undefined) {
      await prisma.$transaction([
        prisma.masterService.deleteMany({ where: { masterId: id } }),
        ...serviceIds.map((sid) =>
          prisma.masterService.create({ data: { masterId: id, serviceId: sid } }),
        ),
      ])
    }

    if (workingHoursPayload !== undefined) {
      const firstLocation = await prisma.location.findFirst()
      const locationId = existing.locationId ?? firstLocation?.id ?? null
      if (locationId) {
        await prisma.workingHour.deleteMany({ where: { masterId: id } })
        if (workingHoursPayload.length > 0) {
          await prisma.workingHour.createMany({
            data: workingHoursPayload.map((row) => ({
              masterId: id,
              locationId,
              dayOfWeek: row.dayOfWeek,
              startTime: row.startTime,
              endTime: row.endTime,
            })),
          })
        }
      }
    }

    const master = await prisma.user.update({
      where: { id },
      data: profileFields,
      select: masterSelect,
    })

    return { master: flattenMaster(master) }
  })

  // ── Catalog ─────────────────────────────────────────────────

  app.get("/catalog", {
    preHandler: adminPreHandlers,
  }, async () => {
    const items = await prisma.catalogItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { titleRu: "asc" }],
      select: {
        id: true,
        category: true,
        type: true,
        gender: true,
        groupKey: true,
        titleRu: true,
        subtitleRu: true,
        descriptionRu: true,
        price: true,
        durationMin: true,
        isVisible: true,
        sortOrder: true,
        serviceId: true,
      },
    })
    return { items }
  })

  app.patch("/catalog/:id", {
    preHandler: adminPreHandlers,
  }, async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string }

    const body = catalogPatchBody.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: body.error.issues.map((i) => i.message).join("; "),
      })
    }

    const existing = await prisma.catalogItem.findUnique({
      where: { id },
      select: { id: true, serviceId: true, durationMin: true, price: true },
    })
    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Элемент каталога не найден",
      })
    }

    const data: Record<string, unknown> = { ...body.data }

    // Keep subtitleRu in sync with durationMin for duration-based items
    if (data.durationMin !== undefined) {
      const newDur = data.durationMin as number | null
      if (newDur != null) {
        data.subtitleRu = `${newDur} мин`
      }
    }

    const updated = await prisma.catalogItem.update({
      where: { id },
      data,
      select: {
        id: true,
        category: true,
        type: true,
        gender: true,
        groupKey: true,
        titleRu: true,
        subtitleRu: true,
        descriptionRu: true,
        price: true,
        durationMin: true,
        isVisible: true,
        sortOrder: true,
        serviceId: true,
      },
    })

    // Sync linked Service so booking/availability stays consistent
    if (existing.serviceId && (data.durationMin !== undefined || data.price !== undefined)) {
      const serviceData: Record<string, unknown> = {}
      const finalDur = data.durationMin !== undefined ? data.durationMin : existing.durationMin
      const finalPrice = data.price !== undefined ? data.price : existing.price
      if (finalDur != null) serviceData.durationMin = finalDur
      if (finalPrice != null) serviceData.price = finalPrice

      if (Object.keys(serviceData).length > 0) {
        await prisma.service.update({
          where: { id: existing.serviceId },
          data: serviceData,
        }).catch((err) => {
          console.error("[admin-catalog] Service sync error (non-fatal):", err)
        })
      }
    }

    return { item: updated }
  })
}
