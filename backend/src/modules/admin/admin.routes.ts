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
import { getServiceDisplayName } from "../../services/serviceDisplayName"
import { recalcAffectedPackages } from "../../services/packageAggregateSync"
import { assertNoDuplicatePackageComposition } from "../../services/packageDuplicateCheck"
import { assertNoDuplicateSubscription } from "../../services/subscriptionDuplicateCheck"
import { normalizePhone } from "../../lib/phoneNormalize"
import type { CatalogCategory, CatalogGender } from "@prisma/client"

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

const servicesQuery = z.object({
  gender: z.enum(["FEMALE", "MALE", "UNISEX", "NONE"]).optional(),
  serviceKind: z.enum(["BUSINESS", "LEGACY_TEMPLATE"]).optional(),
  category: z.enum(["LASER", "WAX", "ELECTRO", "MASSAGE"]).optional(),
  locationId: z.string().uuid().optional(),
})

const packagesQuery = z.object({
  gender: z.enum(["FEMALE", "MALE", "UNISEX", "NONE"]).optional(),
})

const statusPatchBody = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED", "COMPLETED"]),
})

const catalogPatchBody = z.object({
  titleRu: z.string().min(1, "titleRu не может быть пустым").optional(),
  descriptionRu: z.string().nullable().optional(),
  sessionsNoteRu: z.string().nullable().optional(),
  price: z.number().int().min(0, "price >= 0").nullable().optional(),
  durationMin: z.number().int().min(1, "durationMin > 0").nullable().optional(),
  isVisible: z.boolean().optional(),
  sortOrder: z.number().int().min(0, "sortOrder >= 0").optional(),
  packageItemIds: z.array(z.string().uuid()).optional(),
})

const catalogCategoryEnum = z.enum(["LASER", "WAX", "ELECTRO", "MASSAGE"])
const catalogGenderEnum = z.enum(["FEMALE", "MALE", "UNISEX"])
const groupKeyEnum = z.enum(["face", "body", "intimate", "other", "time"])

const servicePatchBody = z.object({
  name: z.string().min(1, "name не может быть пустым").optional(),
  category: catalogCategoryEnum.nullable().optional(),
  gender: catalogGenderEnum.nullable().optional(),
  groupKey: groupKeyEnum.nullable().optional(),
  price: z.number().int().min(0, "price >= 0").optional(),
  durationMin: z.number().int().min(1, "durationMin > 0").optional(),
  sessionDurationLabelRu: z.string().nullable().optional(),
  sessionsNoteRu: z.string().nullable().optional(),
  courseTermRu: z.string().nullable().optional(),
  isVisible: z.boolean().optional(),
  showOnWebsite: z.boolean().optional(),
  showInBot: z.boolean().optional(),
  sortOrder: z.number().int().min(0, "sortOrder >= 0").optional(),
})

const packagePatchBody = z.object({
  name: z.string().min(1, "name не может быть пустым").optional(),
  gender: catalogGenderEnum.nullable().optional(),
  isVisible: z.boolean().optional(),
  showOnWebsite: z.boolean().optional(),
  showInBot: z.boolean().optional(),
  sortOrder: z.number().int().min(0, "sortOrder >= 0").optional(),
})

const packageCreateBody = z.object({
  name: z.string().min(1, "name обязательно"),
  category: catalogCategoryEnum,
  gender: catalogGenderEnum,
  locationId: z.string().uuid("невалидный locationId"),
  serviceIds: z.array(z.string().uuid())
    .min(1, "serviceIds не может быть пустым")
    .refine((ids) => new Set(ids).size === ids.length, "serviceIds должны быть уникальными"),
  isVisible: z.boolean().optional(),
  showOnWebsite: z.boolean().optional(),
  showInBot: z.boolean().optional(),
  sortOrder: z.number().int().min(0, "sortOrder >= 0").optional(),
})

const subscriptionBaseQuery = z.object({
  category: catalogCategoryEnum,
  gender: z
    .union([catalogGenderEnum, z.literal("NONE"), z.literal("")])
    .optional()
    .transform((v) => (v === "NONE" || v === "" || v === undefined ? null : v)),
  locationId: z.string().uuid("невалидный locationId"),
})

const subscriptionCreateBody = z.object({
  name: z.string().min(1, "name обязательно"),
  description: z.string().optional(),
  baseType: z.enum(["SERVICE", "PACKAGE"]),
  baseServiceId: z.string().uuid().optional(),
  basePackageId: z.string().uuid().optional(),
  quantity: z.number().int().min(1, "quantity >= 1"),
  discountPercent: z.number().int().min(0).max(100, "discountPercent 0-100"),
  isVisible: z.boolean().optional(),
  showOnWebsite: z.boolean().optional(),
  showInBot: z.boolean().optional(),
  sortOrder: z.number().int().min(0, "sortOrder >= 0").optional(),
})

const subscriptionPatchBody = z.object({
  name: z.string().min(1, "name обязательно").optional(),
  description: z.string().nullable().optional(),
  quantity: z.number().int().min(1, "quantity >= 1").optional(),
  discountPercent: z.number().int().min(0).max(100, "discountPercent 0-100").optional(),
  isVisible: z.boolean().optional(),
  showOnWebsite: z.boolean().optional(),
  showInBot: z.boolean().optional(),
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
        customerId: true,
        source: true,
        serviceId: true,
        masterId: true,
      },
    })

    const userIds = [...new Set(bookings.map((b) => b.userId))]
    const customerIds = [...new Set(bookings.map((b) => b.customerId).filter(Boolean) as string[])]
    const serviceIds = [...new Set(bookings.map((b) => b.serviceId).filter(Boolean) as string[])]
    const masterIds = [...new Set(bookings.map((b) => b.masterId).filter(Boolean) as string[])]

    const [users, customers, services, masters] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, telegramId: true },
      }),
      customerIds.length > 0
        ? prisma.customer.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, name: true, phone: true, telegramId: true },
          })
        : [],
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
    const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]))
    const serviceMap = Object.fromEntries(services.map((s) => [s.id, s]))
    const masterMap = Object.fromEntries(masters.map((m) => [m.id, m]))

    const items = bookings.map((b) => {
      const customer = b.customerId ? customerMap[b.customerId] : null
      const user = userMap[b.userId]
      const service = b.serviceId ? serviceMap[b.serviceId] : null
      const master = b.masterId ? masterMap[b.masterId] : null

      const client = customer
        ? { name: customer.name, email: null as string | null, telegramId: customer.telegramId }
        : user
          ? { name: user.name, email: user.email, telegramId: user.telegramId }
          : null

      return {
        id: b.id,
        status: b.status,
        scheduledAt: b.scheduledAt,
        createdAt: b.createdAt,
        confirmedAt: b.confirmedAt,
        cancelledAt: b.cancelledAt,
        completedAt: b.completedAt,
        client,
        customerName: customer?.name ?? user?.name ?? null,
        customerPhone: customer?.phone ?? null,
        source: b.source,
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

  // ── Customer search ──────────────────────────────────────────

  app.get("/customers/search", {
    preHandler: adminPreHandlers,
  }, async (request: FastifyRequest, reply) => {
    const q = (request.query as { q?: string }).q
    if (!q || typeof q !== "string" || q.trim().length < 2) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Query q must be at least 2 characters",
      })
    }
    const normalized = normalizePhone(q)
    const searchTerm = q.trim()
    const where =
      normalized && normalized.length >= 2
        ? {
            OR: [
              { name: { contains: searchTerm, mode: "insensitive" as const } },
              { phone: { contains: normalized, mode: "insensitive" as const } },
            ],
          }
        : { name: { contains: searchTerm, mode: "insensitive" as const } }
    const customers = await prisma.customer.findMany({
      where,
      take: 20,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        telegramId: true,
        telegramUsername: true,
      },
    })
    return { customers }
  })

  // ── Customer create ───────────────────────────────────────────

  const customerCreateBody = z.object({
    name: z.string().min(1, "name обязательно"),
    phone: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })

  app.post("/customers", {
    preHandler: adminPreHandlers,
  }, async (request: FastifyRequest, reply) => {
    const body = customerCreateBody.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: body.error.issues.map((i) => i.message).join("; "),
      })
    }
    const { name, phone, notes } = body.data
    const phoneVal = phone?.trim() || null
    const normalizedPhone = phoneVal ? normalizePhone(phoneVal) : null
    if (normalizedPhone && normalizedPhone.length > 0) {
      const existing = await prisma.customer.findFirst({
        where: { phone: normalizedPhone },
        select: { id: true },
      })
      if (existing) {
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: "Customer with this phone already exists",
        })
      }
    }
    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        phone: normalizedPhone?.length ? normalizedPhone : null,
        notes: notes?.trim() || null,
      },
    })
    return { customer }
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
        const [service, master, catalogItem] = await Promise.all([
          booking.serviceId
            ? prisma.service.findUnique({ where: { id: booking.serviceId }, select: { name: true, durationMin: true } })
            : null,
          booking.masterId
            ? prisma.user.findUnique({ where: { id: booking.masterId }, select: { name: true } })
            : null,
          booking.serviceId
            ? prisma.catalogItem.findFirst({
                where: { serviceId: booking.serviceId },
                select: { titleRu: true },
                orderBy: { sortOrder: "asc" },
              })
            : null,
        ])
        const serviceDisplayName = service?.name ? getServiceDisplayName(service.name) : null
        await sendBookingStatusNotification({
          telegramId: booking.user.telegramId,
          newStatus,
          serviceName: serviceDisplayName ?? service?.name ?? null,
          masterName: master?.name ?? null,
          scheduledAt: booking.scheduledAt,
          durationMin: service?.durationMin ?? null,
          zone: catalogItem?.titleRu ?? null,
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

  // ── Zones dictionary ────────────────────────────────────────

  const zoneKeySlug = z.string().min(1).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "zoneKey: только строчные буквы, цифры и дефисы")

  const zoneCreateBody = z.object({
    zoneKey: zoneKeySlug,
    labelRu: z.string().min(1, "labelRu обязательно"),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })

  const zonePatchBody = z.object({
    labelRu: z.string().min(1, "labelRu обязательно").optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })

  app.get("/zones", {
    preHandler: adminPreHandlers,
  }, async () => {
    const zones = await prisma.zone.findMany({
      orderBy: [{ sortOrder: "asc" }, { labelRu: "asc" }],
      select: { id: true, zoneKey: true, labelRu: true, isActive: true, sortOrder: true },
    })
    return { zones }
  })

  app.post("/zones", {
    preHandler: adminPreHandlers,
  }, async (request: FastifyRequest, reply) => {
    const body = zoneCreateBody.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: body.error.issues.map((i) => i.message).join("; "),
      })
    }

    const existing = await prisma.zone.findUnique({
      where: { zoneKey: body.data.zoneKey },
      select: { id: true },
    })
    if (existing) {
      return reply.status(409).send({
        statusCode: 409,
        error: "Conflict",
        message: `Зона с ключом "${body.data.zoneKey}" уже существует`,
      })
    }

    const created = await prisma.zone.create({
      data: {
        zoneKey: body.data.zoneKey,
        labelRu: body.data.labelRu,
        isActive: body.data.isActive ?? true,
        sortOrder: body.data.sortOrder ?? 0,
      },
      select: { id: true, zoneKey: true, labelRu: true, isActive: true, sortOrder: true },
    })
    return reply.status(201).send({ zone: created })
  })

  app.patch("/zones/:id", {
    preHandler: adminPreHandlers,
  }, async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string }
    const body = zonePatchBody.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: body.error.issues.map((i) => i.message).join("; "),
      })
    }

    const updated = await prisma.zone.update({
      where: { id },
      data: body.data,
      select: { id: true, zoneKey: true, labelRu: true, isActive: true, sortOrder: true },
    })
    return { zone: updated }
  })

  // ── Service zones (legacy, derived from services) ─────────────

  app.get("/service-zones", {
    preHandler: adminPreHandlers,
  }, async () => {
    const rows = await prisma.service.findMany({
      where: { zoneKey: { not: null } },
      select: { zoneKey: true, name: true },
      orderBy: { name: "asc" },
    })

    const labelMap = new Map<string, Map<string, number>>()
    for (const r of rows) {
      const zk = r.zoneKey!
      if (!labelMap.has(zk)) labelMap.set(zk, new Map())
      const counts = labelMap.get(zk)!
      counts.set(r.name, (counts.get(r.name) ?? 0) + 1)
    }

    const zones: { zoneKey: string; label: string }[] = []
    for (const [zoneKey, counts] of labelMap) {
      let bestLabel = ""
      let bestCount = 0
      for (const [name, count] of counts) {
        if (count > bestCount) { bestLabel = name; bestCount = count }
      }
      zones.push({ zoneKey, label: bestLabel })
    }

    zones.sort((a, b) => a.label.localeCompare(b.label, "ru"))
    return { zones }
  })

  // ── Locations (for admin dropdowns) ────────────────────────

  app.get("/locations", {
    preHandler: adminPreHandlers,
  }, async () => {
    const locations = await prisma.location.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
    return { locations }
  })

  // ── Create service ──────────────────────────────────────────

  const serviceCreateBody = z.object({
    name: z.string().min(1, "name обязательно"),
    category: catalogCategoryEnum,
    gender: catalogGenderEnum.nullable(),
    zoneKey: z.string().min(1, "zoneKey обязательно"),
    groupKey: groupKeyEnum,
    price: z.number().int().min(0, "price >= 0"),
    durationMin: z.number().int().min(1, "durationMin > 0"),
    locationId: z.string().uuid("невалидный locationId"),
    isVisible: z.boolean().optional(),
    showOnWebsite: z.boolean().optional(),
    showInBot: z.boolean().optional(),
    sortOrder: z.number().int().min(0, "sortOrder >= 0").optional(),
  })

  app.post("/services", {
    preHandler: adminPreHandlers,
  }, async (request: FastifyRequest, reply) => {
    const body = serviceCreateBody.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: body.error.issues.map((i) => i.message).join("; "),
      })
    }

    const { name, category, gender, zoneKey, groupKey, price, durationMin, locationId,
      isVisible, showOnWebsite, showInBot, sortOrder } = body.data

    const duplicate = await prisma.service.findFirst({
      where: { category, gender, locationId, zoneKey },
      select: { id: true, name: true },
    })
    if (duplicate) {
      return reply.status(409).send({
        statusCode: 409,
        error: "Conflict",
        message: `Услуга с такой зоной уже существует: "${duplicate.name}" (${duplicate.id})`,
      })
    }

    const created = await prisma.service.create({
      data: {
        name,
        category,
        gender,
        zoneKey,
        price,
        durationMin,
        locationId,
        serviceKind: "BUSINESS",
        sourceCatalogItemId: null,
        isVisible: isVisible ?? true,
        showOnWebsite: showOnWebsite ?? true,
        showInBot: showInBot ?? true,
        sortOrder: sortOrder ?? 0,
      },
      select: {
        id: true,
        name: true,
        category: true,
        gender: true,
        zoneKey: true,
        groupKey: true,
        price: true,
        durationMin: true,
        serviceKind: true,
        isVisible: true,
        showOnWebsite: true,
        showInBot: true,
        sortOrder: true,
        locationId: true,
        location: { select: { id: true, name: true } },
        sourceCatalogItemId: true,
      },
    })

    return reply.status(201).send({
      service: {
        id: created.id,
        name: created.name,
        category: created.category,
        gender: created.gender,
        zoneKey: created.zoneKey,
        groupKey: created.groupKey,
        price: created.price,
        durationMin: created.durationMin,
        serviceKind: created.serviceKind,
        isVisible: created.isVisible,
        showOnWebsite: created.showOnWebsite,
        showInBot: created.showInBot,
        sortOrder: created.sortOrder,
        locationId: created.locationId,
        location: created.location,
        fromCatalog: false,
      },
    })
  })

  // ── Services list ──────────────────────────────────────────

  app.get("/services", {
    preHandler: adminPreHandlers,
  }, async (request: FastifyRequest, reply) => {
    const q = servicesQuery.safeParse(request.query)
    if (!q.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Invalid query parameters",
      })
    }
    const where: Record<string, unknown> = {}
    if (q.data.gender !== undefined) {
      where.gender = q.data.gender === "NONE" ? null : q.data.gender
    }
    if (q.data.category !== undefined) where.category = q.data.category
    if (q.data.locationId !== undefined) where.locationId = q.data.locationId
    where.serviceKind = q.data.serviceKind ?? "BUSINESS"
    const services = await prisma.service.findMany({
      where: where as any,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
        gender: true,
        groupKey: true,
        durationMin: true,
        price: true,
        sessionDurationLabelRu: true,
        sessionsNoteRu: true,
        courseTermRu: true,
        serviceKind: true,
        isVisible: true,
        showOnWebsite: true,
        showInBot: true,
        sortOrder: true,
        locationId: true,
        sourceCatalogItemId: true,
        location: { select: { id: true, name: true } },
      },
    })
    return {
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        gender: s.gender,
        groupKey: s.groupKey,
        durationMin: s.durationMin,
        price: s.price,
        sessionDurationLabelRu: s.sessionDurationLabelRu,
        sessionsNoteRu: s.sessionsNoteRu,
        courseTermRu: s.courseTermRu,
        serviceKind: s.serviceKind,
        isVisible: s.isVisible,
        showOnWebsite: s.showOnWebsite,
        showInBot: s.showInBot,
        sortOrder: s.sortOrder,
        locationId: s.locationId,
        location: s.location,
        fromCatalog: !!s.sourceCatalogItemId,
      })),
    }
  })

  app.get("/packages", {
    preHandler: adminPreHandlers,
  }, async (request: FastifyRequest, reply) => {
    const q = packagesQuery.safeParse(request.query)
    if (!q.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Invalid query parameters",
      })
    }
    const where: Record<string, unknown> = {
      OR: [
        { sourceLegacyPackageId: { not: null } },
        { packageKind: "MANUAL" },
      ],
    }
    if (q.data.gender !== undefined) {
      where.gender = q.data.gender === "NONE" ? null : q.data.gender
    }
    const packages = await prisma.package.findMany({
      where: where as any,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
        gender: true,
        price: true,
        durationMin: true,
        isVisible: true,
        showOnWebsite: true,
        showInBot: true,
        sortOrder: true,
        locationId: true,
        normalizedVariantKey: true,
        sourceLegacyPackageId: true,
        location: { select: { id: true, name: true } },
        services: {
          orderBy: { sortOrder: "asc" },
          select: { service: { select: { id: true, name: true } } },
        },
      },
    })
    return {
      packages: packages.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        gender: p.gender,
        price: p.price,
        durationMin: p.durationMin,
        isVisible: p.isVisible,
        showOnWebsite: p.showOnWebsite,
        showInBot: p.showInBot,
        sortOrder: p.sortOrder,
        locationId: p.locationId,
        location: p.location,
        normalizedVariantKey: p.normalizedVariantKey,
        services: p.services.map((ps) => ({ id: ps.service.id, name: ps.service.name })),
      })),
    }
  })

  app.post("/packages", {
    preHandler: adminPreHandlers,
  }, async (request: FastifyRequest, reply) => {
    const body = packageCreateBody.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: body.error.issues.map((i) => i.message).join("; "),
      })
    }

    const { name, category, gender, locationId, serviceIds, isVisible, showOnWebsite, showInBot, sortOrder } = body.data

    try {
      await assertNoDuplicatePackageComposition({ category, gender, locationId, serviceIds })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.startsWith("DUPLICATE_PACKAGE:")) {
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: msg.replace("DUPLICATE_PACKAGE: ", ""),
        })
      }
      throw e
    }

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, price: true, durationMin: true },
    })

    if (services.length !== serviceIds.length) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Не все услуги найдены. Проверьте выбранные услуги.",
      })
    }

    const price = services.reduce((s, svc) => s + svc.price, 0)
    const durationMin = services.reduce((s, svc) => s + svc.durationMin, 0)

    const created = await prisma.$transaction(async (tx) => {
      const pkg = await tx.package.create({
        data: {
          name,
          category,
          gender,
          locationId,
          price,
          durationMin,
          packageKind: "MANUAL",
          sourceLegacyPackageId: null,
          normalizedVariantKey: null,
          isVisible: isVisible ?? true,
          showOnWebsite: showOnWebsite ?? true,
          showInBot: showInBot ?? false,
          sortOrder: sortOrder ?? 0,
        },
        select: {
          id: true,
          name: true,
          category: true,
          gender: true,
          price: true,
          durationMin: true,
          isVisible: true,
          showOnWebsite: true,
          showInBot: true,
          sortOrder: true,
          locationId: true,
          location: { select: { id: true, name: true } },
        },
      })

      for (let i = 0; i < serviceIds.length; i++) {
        await tx.packageService.create({
          data: { packageId: pkg.id, serviceId: serviceIds[i], sortOrder: i },
        })
      }

      return pkg
    })

    return reply.status(201).send({
      package: {
        id: created.id,
        name: created.name,
        category: created.category,
        gender: created.gender,
        price: created.price,
        durationMin: created.durationMin,
        isVisible: created.isVisible,
        showOnWebsite: created.showOnWebsite,
        showInBot: created.showInBot,
        sortOrder: created.sortOrder,
        locationId: created.locationId,
        location: created.location,
        normalizedVariantKey: null,
      },
    })
  })

  // ── Subscription base selection (for Subscription Builder) ───────

  app.get("/subscription-base-services", {
    preHandler: adminPreHandlers,
  }, async (request: FastifyRequest, reply) => {
    const q = subscriptionBaseQuery.safeParse(request.query)
    if (!q.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: q.error.issues.map((i) => i.message).join("; "),
      })
    }
    const { category, gender, locationId } = q.data
    const services = await prisma.service.findMany({
      where: {
        serviceKind: "BUSINESS",
        category,
        gender,
        locationId,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
        gender: true,
        price: true,
        durationMin: true,
        locationId: true,
      },
    })
    return { services }
  })

  app.get("/subscription-base-packages", {
    preHandler: adminPreHandlers,
  }, async (request: FastifyRequest, reply) => {
    const q = subscriptionBaseQuery.safeParse(request.query)
    if (!q.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: q.error.issues.map((i) => i.message).join("; "),
      })
    }
    const { category, gender, locationId } = q.data
    const packages = await prisma.package.findMany({
      where: {
        category,
        gender,
        locationId,
        packageKind: { in: ["MIGRATED", "MANUAL"] },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
        gender: true,
        price: true,
        durationMin: true,
        locationId: true,
      },
    })
    return { packages }
  })

  // ── Subscriptions ─────────────────────────────────────────────

  app.get("/subscriptions", {
    preHandler: adminPreHandlers,
  }, async () => {
    const subs = await prisma.subscription.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        gender: true,
        quantity: true,
        discountPercent: true,
        finalPrice: true,
        isVisible: true,
        showOnWebsite: true,
        showInBot: true,
        sortOrder: true,
        locationId: true,
        baseServiceId: true,
        basePackageId: true,
        baseService: { select: { id: true, name: true } },
        basePackage: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    })
    return {
      subscriptions: subs.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category,
        gender: s.gender,
        quantity: s.quantity,
        discountPercent: s.discountPercent,
        finalPrice: s.finalPrice,
        isVisible: s.isVisible,
        showOnWebsite: s.showOnWebsite,
        showInBot: s.showInBot,
        sortOrder: s.sortOrder,
        locationId: s.locationId,
        location: s.location,
        baseServiceId: s.baseServiceId,
        basePackageId: s.basePackageId,
        baseService: s.baseService,
        basePackage: s.basePackage,
      })),
    }
  })

  app.post("/subscriptions", {
    preHandler: adminPreHandlers,
  }, async (request: FastifyRequest, reply) => {
    const body = subscriptionCreateBody.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: body.error.issues.map((i) => i.message).join("; "),
      })
    }

    const {
      name,
      description,
      baseType,
      baseServiceId,
      basePackageId,
      quantity,
      discountPercent,
      isVisible,
      showOnWebsite,
      showInBot,
      sortOrder,
    } = body.data

    const hasService = baseType === "SERVICE" && baseServiceId
    const hasPackage = baseType === "PACKAGE" && basePackageId
    if (!hasService && !hasPackage) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "baseType SERVICE requires baseServiceId; baseType PACKAGE requires basePackageId",
      })
    }
    if (hasService && basePackageId) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "basePackageId must be empty when baseType is SERVICE",
      })
    }
    if (hasPackage && baseServiceId) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "baseServiceId must be empty when baseType is PACKAGE",
      })
    }

    const baseServiceIdVal = hasService ? baseServiceId! : null
    const basePackageIdVal = hasPackage ? basePackageId! : null

    let baseEntity: { name: string; category: CatalogCategory | null; gender: CatalogGender | null; locationId: string; price: number }
    if (hasService) {
      const svc = await prisma.service.findUnique({
        where: { id: baseServiceIdVal! },
        select: { id: true, name: true, category: true, gender: true, locationId: true, price: true },
      })
      if (!svc) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Услуга не найдена",
        })
      }
      baseEntity = svc
    } else {
      const pkg = await prisma.package.findUnique({
        where: { id: basePackageIdVal! },
        select: { id: true, name: true, category: true, gender: true, locationId: true, price: true },
      })
      if (!pkg) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Комплекс не найден",
        })
      }
      baseEntity = pkg
    }

    if (!baseEntity.category) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Основа должна иметь тип процедуры (category)",
      })
    }

    const category: CatalogCategory = baseEntity.category
    const gender: CatalogGender | null = baseEntity.gender ?? null
    const locationId = baseEntity.locationId

    const dupInput = {
      category,
      gender,
      locationId,
      baseServiceId: baseServiceIdVal,
      basePackageId: basePackageIdVal,
      quantity,
      discountPercent,
    }

    try {
      await assertNoDuplicateSubscription(dupInput)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.startsWith("DUPLICATE_SUBSCRIPTION:")) {
        const baseName = baseEntity.name ?? ""
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: `Абонемент с такими параметрами уже существует.\nОснова: ${baseName}.\nКоличество: ${quantity}.\nСкидка: ${discountPercent}%.`,
        })
      }
      throw e
    }

    const finalPrice = Math.round(
      baseEntity.price * quantity * (1 - discountPercent / 100),
    )

    const created = await prisma.subscription.create({
      data: {
        name,
        description: description ?? null,
        category,
        gender,
        locationId,
        baseServiceId: baseServiceIdVal,
        basePackageId: basePackageIdVal,
        quantity,
        discountPercent,
        finalPrice,
        isVisible: isVisible ?? true,
        showOnWebsite: showOnWebsite ?? true,
        showInBot: showInBot ?? false,
        sortOrder: sortOrder ?? 0,
      },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        gender: true,
        quantity: true,
        discountPercent: true,
        finalPrice: true,
        isVisible: true,
        showOnWebsite: true,
        showInBot: true,
        sortOrder: true,
        locationId: true,
        baseServiceId: true,
        basePackageId: true,
        baseService: { select: { id: true, name: true } },
        basePackage: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    })

    return reply.status(201).send({ subscription: created })
  })

  app.patch("/subscriptions/:id", {
    preHandler: adminPreHandlers,
  }, async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string }
    const body = subscriptionPatchBody.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: body.error.issues.map((i) => i.message).join("; "),
      })
    }
    const existing = await prisma.subscription.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        gender: true,
        quantity: true,
        discountPercent: true,
        finalPrice: true,
        isVisible: true,
        showOnWebsite: true,
        showInBot: true,
        sortOrder: true,
        locationId: true,
        baseServiceId: true,
        basePackageId: true,
        baseService: { select: { id: true, price: true } },
        basePackage: { select: { id: true, price: true } },
      },
    })
    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Абонемент не найден",
      })
    }

    const baseEntity = existing.baseService ?? existing.basePackage
    if (!baseEntity) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Абонемент без базовой услуги или пакета",
      })
    }

    const data: Record<string, unknown> = { ...body.data }
    const quantity = data.quantity ?? existing.quantity
    const discountPercent = data.discountPercent ?? existing.discountPercent
    const qtyOrDiscountChanged =
      data.quantity !== undefined || data.discountPercent !== undefined

    if (qtyOrDiscountChanged) {
      try {
        await assertNoDuplicateSubscription(
          {
            category: existing.category,
            gender: existing.gender,
            locationId: existing.locationId,
            baseServiceId: existing.baseServiceId,
            basePackageId: existing.basePackageId,
            quantity: quantity as number,
            discountPercent: discountPercent as number,
          },
          id,
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.startsWith("DUPLICATE_SUBSCRIPTION:")) {
          return reply.status(409).send({
            statusCode: 409,
            error: "Conflict",
            message: "Уже существует абонемент с таким же составом, количеством и скидкой. Измените количество или скидку.",
          })
        }
        throw err
      }
    }

    if (qtyOrDiscountChanged) {
      const basePrice = baseEntity.price
      data.finalPrice = Math.round(
        basePrice * (quantity as number) * (1 - (discountPercent as number) / 100),
      )
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        gender: true,
        quantity: true,
        discountPercent: true,
        finalPrice: true,
        isVisible: true,
        showOnWebsite: true,
        showInBot: true,
        sortOrder: true,
        locationId: true,
        baseServiceId: true,
        basePackageId: true,
        baseService: { select: { id: true, name: true } },
        basePackage: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    })

    return reply.send({ subscription: updated })
  })

  app.patch("/services/:id", {
    preHandler: adminPreHandlers,
  }, async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string }
    const body = servicePatchBody.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: body.error.issues.map((i) => i.message).join("; "),
      })
    }
    const existing = await prisma.service.findUnique({
      where: { id },
      select: { id: true, serviceKind: true },
    })
    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Услуга не найдена",
      })
    }
    if (existing.serviceKind === "LEGACY_TEMPLATE") {
      return reply.status(403).send({
        statusCode: 403,
        error: "Forbidden",
        message: "Системные шаблонные услуги нельзя редактировать.",
      })
    }
    const data = { ...body.data }
    const priceOrDurationChanged = data.price !== undefined || data.durationMin !== undefined

    const updated = await prisma.service.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        category: true,
        gender: true,
        groupKey: true,
        price: true,
        durationMin: true,
        sessionDurationLabelRu: true,
        sessionsNoteRu: true,
        courseTermRu: true,
        isVisible: true,
        showOnWebsite: true,
        showInBot: true,
        sortOrder: true,
        locationId: true,
        location: { select: { id: true, name: true } },
        sourceCatalogItemId: true,
      },
    })

    if (priceOrDurationChanged) {
      recalcAffectedPackages(id).catch((err) => {
        console.error("[admin] Package aggregate sync error (non-fatal):", err)
      })
    }

    return {
      service: {
        id: updated.id,
        name: updated.name,
        category: updated.category,
        gender: updated.gender,
        groupKey: updated.groupKey,
        price: updated.price,
        durationMin: updated.durationMin,
        sessionDurationLabelRu: updated.sessionDurationLabelRu,
        sessionsNoteRu: updated.sessionsNoteRu,
        courseTermRu: updated.courseTermRu,
        isVisible: updated.isVisible,
        showOnWebsite: updated.showOnWebsite,
        showInBot: updated.showInBot,
        sortOrder: updated.sortOrder,
        locationId: updated.locationId,
        location: updated.location,
        fromCatalog: !!updated.sourceCatalogItemId,
      },
    }
  })

  app.patch("/packages/:id", {
    preHandler: adminPreHandlers,
  }, async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string }
    const body = packagePatchBody.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: body.error.issues.map((i) => i.message).join("; "),
      })
    }
    const existing = await prisma.package.findUnique({
      where: { id },
      select: { id: true, sourceLegacyPackageId: true, packageKind: true },
    })
    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Комплекс не найден",
      })
    }
    const isLegacy = existing.sourceLegacyPackageId === null && existing.packageKind !== "MANUAL"
    if (isLegacy) {
      return reply.status(403).send({
        statusCode: 403,
        error: "Forbidden",
        message: "Редактирование legacy-комплексов запрещено. Используйте только нормализованные комплексы.",
      })
    }
    const data = { ...body.data }
    const updated = await prisma.package.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        category: true,
        gender: true,
        price: true,
        durationMin: true,
        isVisible: true,
        showOnWebsite: true,
        showInBot: true,
        sortOrder: true,
        locationId: true,
        normalizedVariantKey: true,
        location: { select: { id: true, name: true } },
      },
    })
    return {
      package: {
        id: updated.id,
        name: updated.name,
        category: updated.category,
        gender: updated.gender,
        price: updated.price,
        durationMin: updated.durationMin,
        isVisible: updated.isVisible,
        showOnWebsite: updated.showOnWebsite,
        showInBot: updated.showInBot,
        sortOrder: updated.sortOrder,
        locationId: updated.locationId,
        location: updated.location,
        normalizedVariantKey: updated.normalizedVariantKey,
      },
    }
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
    const rows = await prisma.catalogItem.findMany({
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
        sessionsNoteRu: true,
        price: true,
        durationMin: true,
        isVisible: true,
        sortOrder: true,
        serviceId: true,
        packageItemsAsPackage: {
          orderBy: { sortOrder: "asc" },
          select: {
            itemId: true,
            sortOrder: true,
            item: { select: { id: true, titleRu: true, price: true, durationMin: true } },
          },
        },
      },
    })
    const items = rows.map((row) => {
      let price = row.price ?? null
      let durationMin = row.durationMin ?? null
      if (row.type === "PACKAGE" && row.packageItemsAsPackage?.length) {
        price = row.packageItemsAsPackage.reduce((s, p) => s + (p.item.price ?? 0), 0)
        durationMin = row.packageItemsAsPackage.reduce((s, p) => s + (p.item.durationMin ?? 0), 0)
      }
      const packageItems = row.packageItemsAsPackage?.map((p) => ({
        itemId: p.itemId,
        sortOrder: p.sortOrder,
        titleRu: p.item.titleRu,
      })) ?? []
      const { packageItemsAsPackage: _, ...rest } = row
      return { ...rest, price, durationMin, packageItems }
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
      select: { id: true, type: true, serviceId: true, durationMin: true, price: true },
    })
    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Элемент каталога не найден",
      })
    }

    const data: Record<string, unknown> = { ...body.data }
    const packageItemIds = body.data.packageItemIds

    if (existing.type === "PACKAGE") {
      delete data.price
      delete data.durationMin
      if (packageItemIds !== undefined) {
        await prisma.catalogItemPackage.deleteMany({ where: { packageId: id } })
        for (let i = 0; i < packageItemIds.length; i++) {
          await prisma.catalogItemPackage.create({
            data: { packageId: id, itemId: packageItemIds[i], sortOrder: i },
          })
        }
      }
    } else {
      // Keep subtitleRu in sync with durationMin for non-package items
      if (data.durationMin !== undefined) {
        const newDur = data.durationMin as number | null
        if (newDur != null) {
          data.subtitleRu = `${newDur} мин`
        }
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
        sessionsNoteRu: true,
        price: true,
        durationMin: true,
        isVisible: true,
        sortOrder: true,
        serviceId: true,
        packageItemsAsPackage: {
          orderBy: { sortOrder: "asc" },
          select: { itemId: true, sortOrder: true, item: { select: { id: true, titleRu: true, price: true, durationMin: true } } },
        },
      },
    })

    // Sync linked Service so booking/availability stays consistent (not for PACKAGE)
    if (existing.type !== "PACKAGE" && existing.serviceId && (data.durationMin !== undefined || data.price !== undefined)) {
      const serviceData: Record<string, unknown> = {}
      const finalDur = data.durationMin !== undefined ? data.durationMin : existing.durationMin
      const finalPrice = data.price !== undefined ? data.price : existing.price
      if (finalDur != null) serviceData.durationMin = finalDur
      if (finalPrice != null) serviceData.price = finalPrice

      if (Object.keys(serviceData).length > 0) {
        await prisma.service.update({
          where: { id: existing.serviceId },
          data: serviceData,
        }).then(() => {
          recalcAffectedPackages(existing.serviceId!).catch((err) => {
            console.error("[admin-catalog] Package aggregate sync error (non-fatal):", err)
          })
        }).catch((err) => {
          console.error("[admin-catalog] Service sync error (non-fatal):", err)
        })
      }
    }

    let price = updated.price ?? null
    let durationMin = updated.durationMin ?? null
    if (updated.type === "PACKAGE" && updated.packageItemsAsPackage?.length) {
      price = updated.packageItemsAsPackage.reduce((s, p) => s + (p.item.price ?? 0), 0)
      durationMin = updated.packageItemsAsPackage.reduce((s, p) => s + (p.item.durationMin ?? 0), 0)
    }
    const packageItems = updated.packageItemsAsPackage?.map((p) => ({
      itemId: p.itemId,
      sortOrder: p.sortOrder,
      titleRu: p.item.titleRu,
    })) ?? []
    const { packageItemsAsPackage: _p, ...rest } = updated
    return {
      item: {
        ...rest,
        price,
        durationMin,
        packageItems,
      },
    }
  })
}
