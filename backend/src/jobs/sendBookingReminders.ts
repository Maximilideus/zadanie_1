import { prisma } from "../lib/prisma"
import { SALON_TIMEZONE } from "../config/salon"
import { sendTelegramMessage, type InlineButton } from "../services/telegramSender"
import { formatBookingCardFromBooking } from "../services/bookingCard"
import { getServiceDisplayName } from "../services/serviceDisplayName"
import { env } from "../config/env"

const INTERVAL_MS =
  env.NODE_ENV === "production" ? 2 * 60 * 1000 : 30 * 1000
const REMINDER_10H_MS = 10 * 60 * 60 * 1000
const REMINDER_2H_MS = 2 * 60 * 60 * 1000
const CANCEL_CUTOFF_MS = 4 * 60 * 60 * 1000

export type ReminderJobLogger = {
  info: (bindings: object, message: string) => void
}

const consoleLogger: ReminderJobLogger = {
  info: (bindings, message) => console.log("[reminders]", message, bindings),
}

let running = false

const bookingWithDetailsSelect = {
  id: true,
  scheduledAt: true,
  status: true,
  userId: true,
  serviceId: true,
  masterId: true,
  user: { select: { telegramId: true } },
  reminder10hSentAt: true,
  reminder2hSentAt: true,
} as const

function fmtSalon(d: Date): string {
  return d.toLocaleString("ru-RU", {
    timeZone: SALON_TIMEZONE,
    dateStyle: "short",
    timeStyle: "short",
  })
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "ожидает подтверждения",
  CONFIRMED: "подтверждена",
}

async function loadServiceMasterAndZone(serviceId: string, masterId: string) {
  const [service, master, catalogItem] = await Promise.all([
    prisma.service.findUnique({
      where: { id: serviceId },
      select: { name: true, durationMin: true },
    }),
    prisma.user.findUnique({
      where: { id: masterId },
      select: { name: true },
    }),
    prisma.catalogItem.findFirst({
      where: { serviceId },
      select: { titleRu: true },
      orderBy: { sortOrder: "asc" },
    }),
  ])
  return {
    serviceName: service?.name ? getServiceDisplayName(service.name) : "—",
    masterName: master?.name ?? "—",
    durationMin: service?.durationMin ?? undefined,
    zone: catalogItem?.titleRu ?? undefined,
  }
}

function buildReminderText(
  intro: string,
  serviceName: string,
  masterName: string,
  scheduledAt: Date,
  status: string,
  outro: string,
  options?: { durationMin?: number; zone?: string },
): string {
  const card = formatBookingCardFromBooking(serviceName, masterName, scheduledAt, options)
  const lines = [intro, "", card, `Статус: ${STATUS_LABELS[status] ?? status}`]
  if (outro) {
    lines.push("", outro)
  }
  return lines.join("\n")
}

export interface ReminderRunResult {
  found: number
  sent: number
  skipped: number
  failed: number
}

async function processReminders(log: ReminderJobLogger): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { found: 0, sent: 0, skipped: 0, failed: 0 }

  if (running) {
    log.info({}, "Reminder tick skipped (previous still running)")
    return result
  }
  running = true
  try {
    const now = new Date()
    const cutoff10h = new Date(now.getTime() + REMINDER_10H_MS)
    const cutoff2h = new Date(now.getTime() + REMINDER_2H_MS)

    log.info({ now: now.toISOString(), nowSalon: fmtSalon(now) }, "Reminder tick started")

    const dueBookings = await prisma.booking.findMany({
      where: {
        status: { in: ["PENDING", "CONFIRMED"] },
        scheduledAt: { not: null, gt: now },
        serviceId: { not: null },
        masterId: { not: null },
        user: { telegramId: { not: null } },
        OR: [
          { scheduledAt: { lte: cutoff10h }, reminder10hSentAt: null },
          { scheduledAt: { lte: cutoff2h }, reminder2hSentAt: null },
        ],
      },
      select: bookingWithDetailsSelect,
    })

    result.found = dueBookings.length
    log.info({ count: dueBookings.length }, "Due bookings found")

    if (dueBookings.length === 0) return result

    for (const booking of dueBookings) {
      const telegramId = booking.user.telegramId
      if (!telegramId || !booking.scheduledAt || !booking.serviceId || !booking.masterId) {
        log.info({ bookingId: booking.id, reason: "missing telegramId/scheduledAt/service/master" }, "Booking skipped")
        result.skipped++
        continue
      }

      const scheduledAt = booking.scheduledAt
      const remainingMs = scheduledAt.getTime() - now.getTime()
      const remainingH = +(remainingMs / 3_600_000).toFixed(2)

      const needs10h = !booking.reminder10hSentAt && remainingMs <= REMINDER_10H_MS
      const needs2h = !booking.reminder2hSentAt && remainingMs <= REMINDER_2H_MS

      log.info({
        bookingId: booking.id,
        scheduledAt: scheduledAt.toISOString(),
        scheduledAtSalon: fmtSalon(scheduledAt),
        remainingH,
        needs10h,
        needs2h,
        already10h: !!booking.reminder10hSentAt,
        already2h: !!booking.reminder2hSentAt,
      }, "Evaluating booking")

      const { serviceName, masterName, durationMin, zone } = await loadServiceMasterAndZone(
        booking.serviceId,
        booking.masterId,
      )

      if (needs2h) {
        const reserved = await prisma.booking.updateMany({
          where: { id: booking.id, reminder2hSentAt: null },
          data: { reminder2hSentAt: new Date() },
        })
        if (reserved.count === 0) {
          log.info({ bookingId: booking.id, type: "2h" }, "Reminder already reserved by another tick")
          result.skipped++
          continue
        }

        const text = buildReminderText(
          "Напоминаем: до вашей записи осталось около 2 часов.",
          serviceName,
          masterName,
          scheduledAt,
          booking.status,
          "Ждём вас.",
          { durationMin, zone },
        )

        const ok = await sendTelegramMessage({ chat_id: telegramId, text })

        if (ok) {
          log.info({ bookingId: booking.id, type: "2h" }, "Reminder sent OK")
          result.sent++
        } else {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { reminder2hSentAt: null },
          })
          log.info({ bookingId: booking.id, type: "2h" }, "Reminder send FAILED, reservation rolled back")
          result.failed++
        }
      } else if (needs10h) {
        const reserved = await prisma.booking.updateMany({
          where: { id: booking.id, reminder10hSentAt: null },
          data: { reminder10hSentAt: new Date() },
        })
        if (reserved.count === 0) {
          log.info({ bookingId: booking.id, type: "10h" }, "Reminder already reserved by another tick")
          result.skipped++
          continue
        }

        const canCancel = remainingMs > CANCEL_CUTOFF_MS
        const cancelKeyboard: InlineButton[][] | undefined = canCancel
          ? [[{ text: "Отменить запись", callback_data: `cancel_bk:${booking.id}` }]]
          : undefined

        const outro = canCancel
          ? "Если планы изменились, запись можно отменить не позднее чем за 4 часа до начала."
          : ""

        const text = buildReminderText(
          "Напоминаем о вашей записи.",
          serviceName,
          masterName,
          scheduledAt,
          booking.status,
          outro,
          { durationMin, zone },
        )

        const ok = await sendTelegramMessage({
          chat_id: telegramId,
          text,
          reply_markup: cancelKeyboard ? { inline_keyboard: cancelKeyboard } : undefined,
        })

        if (ok) {
          log.info({ bookingId: booking.id, type: "10h", canCancel }, "Reminder sent OK")
          result.sent++
        } else {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { reminder10hSentAt: null },
          })
          log.info({ bookingId: booking.id, type: "10h" }, "Reminder send FAILED, reservation rolled back")
          result.failed++
        }
      }
    }

    log.info(result, "Reminder tick finished")
    return result
  } catch (e) {
    log.info({ err: e }, "Reminder job error")
    return result
  } finally {
    running = false
  }
}

/** Run one reminder dispatch cycle immediately. Useful for local testing. */
export async function runBookingRemindersOnce(log?: ReminderJobLogger): Promise<ReminderRunResult> {
  const l = log ?? consoleLogger
  l.info({}, "Manual reminder run started")
  const result = await processReminders(l)
  l.info(result, "Manual reminder run finished")
  return result
}

export function startBookingRemindersJob(log: ReminderJobLogger): NodeJS.Timeout | null {
  if (!env.TELEGRAM_BOT_TOKEN) {
    log.info({}, "TELEGRAM_BOT_TOKEN not set, booking reminders disabled")
    return null
  }
  log.info({ intervalS: INTERVAL_MS / 1000 }, `Booking reminders job started (interval: ${INTERVAL_MS / 1000}s)`)
  return setInterval(() => {
    processReminders(log).catch((err) => {
      log.info({ err }, "Reminder job unhandled error")
    })
  }, INTERVAL_MS)
}
