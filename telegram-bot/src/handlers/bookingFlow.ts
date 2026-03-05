import type { Context } from "grammy"
import { InlineKeyboard } from "grammy"
import {
  getServices,
  getMasters,
  getAvailability,
  setBookingService,
  setBookingMaster,
  setBookingTime,
  type ServiceItem,
} from "../api/backend.client.js"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const MAX_SLOT_BUTTONS = 24
const SLOTS_PER_ROW = 3

export interface BookingSession {
  serviceId?: string
  masterId?: string
}

const sessionStore = new Map<number, BookingSession>()

export function getBookingSession(telegramId: number): BookingSession {
  return sessionStore.get(telegramId) ?? {}
}

export function setBookingSession(telegramId: number, data: Partial<BookingSession>): void {
  const current = sessionStore.get(telegramId) ?? {}
  sessionStore.set(telegramId, { ...current, ...data })
}

export function clearBookingSession(telegramId: number): void {
  sessionStore.delete(telegramId)
}

function slotLabel(isoUtc: string, timezone: string): string {
  const date = new Date(isoUtc)
  return date.toLocaleTimeString("ru-RU", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

const SERVICE_BUTTON_MAX_LEN = 16
const SERVICE_BUTTONS_PER_ROW = 2

function serviceShortLabel(name: string): string {
  if (name.length <= SERVICE_BUTTON_MAX_LEN) return name
  return name.slice(0, SERVICE_BUTTON_MAX_LEN) + "…"
}

function serviceListLine(index: number, s: ServiceItem): string {
  return `${index}) ${s.name} — ${s.durationMin} min — ${s.price}`
}

export async function showServiceList(ctx: Context): Promise<void> {
  const services = await getServices()
  if (services.length === 0) {
    await ctx.reply("Нет доступных услуг.")
    return
  }
  const lines = services.map((s, i) => serviceListLine(i + 1, s))
  await ctx.reply(lines.join("\n"))

  const keyboard = new InlineKeyboard()
  for (let i = 0; i < services.length; i++) {
    const s = services[i]
    keyboard.text(serviceShortLabel(s.name), `svc:${s.id}`)
    if ((i + 1) % SERVICE_BUTTONS_PER_ROW === 0) keyboard.row()
  }
  await ctx.reply("Выберите услугу:", { reply_markup: keyboard })
}

export async function onServiceChosen(ctx: Context, serviceId: string): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  try {
    await setBookingService(String(telegramId), serviceId)
  } catch (e) {
    await handleBackendError(ctx, e)
    return
  }
  setBookingSession(telegramId, { serviceId })
  const masters = await getMasters(serviceId)
  if (masters.length === 0) {
    await ctx.reply("Нет доступных мастеров для этой услуги.")
    return
  }
  const keyboard = new InlineKeyboard()
  for (const m of masters) {
    keyboard.text(m.name, `mst:${m.id}`)
  }
  await ctx.editMessageText("Выберите мастера:", { reply_markup: keyboard })
}

export async function onMasterChosen(ctx: Context, masterId: string): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  const session = getBookingSession(telegramId)
  const serviceId = session.serviceId
  if (!serviceId) {
    await ctx.answerCallbackQuery({ text: "Сначала выберите услугу." })
    return
  }
  try {
    await setBookingMaster(String(telegramId), masterId)
  } catch (e) {
    if (e instanceof Error && e.message.includes("Master cannot perform")) {
      await ctx.answerCallbackQuery({
        text: "Этот мастер не выполняет выбранную услугу.",
        show_alert: true,
      })
      const masters = await getMasters(serviceId)
      const keyboard = new InlineKeyboard()
      for (const m of masters) {
        keyboard.text(m.name, `mst:${m.id}`)
      }
      await ctx.editMessageText("Выберите мастера:", { reply_markup: keyboard })
      return
    }
    await handleBackendError(ctx, e)
    return
  }
  setBookingSession(telegramId, { masterId })
  await ctx.editMessageText("Введите дату визита в формате ГГГГ-ММ-ДД (например 2025-06-15):")
}

export async function onDateEntered(
  ctx: Context,
  dateStr: string,
  serviceId: string,
  masterId: string
): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  try {
    const { timezone, slots } = await getAvailability(serviceId, masterId, dateStr)
    if (slots.length === 0) {
      await ctx.reply("На эту дату нет свободных слотов. Введите другую дату (ГГГГ-ММ-ДД).")
      return
    }
    const toShow = slots.slice(0, MAX_SLOT_BUTTONS)
    const keyboard = new InlineKeyboard()
    for (let i = 0; i < toShow.length; i++) {
      const iso = toShow[i]
      keyboard.text(slotLabel(iso, timezone), `t:${iso}`)
      if ((i + 1) % SLOTS_PER_ROW === 0) keyboard.row()
    }
    await ctx.reply("Выберите время:", { reply_markup: keyboard })
  } catch (e) {
    await handleBackendError(ctx, e)
  }
}

export async function onTimeSlotChosen(ctx: Context, scheduledAtIso: string): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  try {
    await setBookingTime(String(telegramId), scheduledAtIso)
  } catch (e) {
    await handleBackendError(ctx, e)
    return
  }
  clearBookingSession(telegramId)
  await ctx.editMessageText(
    "✅ Заявка на запись создана. Ожидайте подтверждения.\n\nПроверить записи: /my_bookings"
  )
}

async function handleBackendError(ctx: Context, e: unknown): Promise<void> {
  const msg = e instanceof Error ? e.message : "Ошибка сервера"
  let text = "Сервис временно недоступен. Попробуйте позже."
  if (msg.includes("NOT_FOUND") || msg.includes("Resource not found")) {
    text = "Данные не найдены. Начните запись заново: /book"
  } else if (msg.includes("No active PENDING") || msg.includes("NO_PENDING")) {
    text = "Нет активной записи. Начните с /book"
  } else if (msg.includes("Select service first") || msg.includes("SELECT_SERVICE")) {
    text = "Сначала выберите услугу."
  } else if (msg.includes("Invalid date") || msg.includes("INVALID_DATE")) {
    text = "Неверный формат даты. Введите ГГГГ-ММ-ДД (например 2025-06-15)."
  } else if (
    msg.includes("within the next 60 days") ||
    msg.includes("DATE_OUT_OF_RANGE")
  ) {
    text =
      "Введите дату в диапазоне от сегодня до 60 дней вперёд (ГГГГ-ММ-ДД)."
  }
  try {
    await ctx.reply(text).catch(() => {})
  } catch {
    // ignore
  }
}

export function isDateString(text: string): boolean {
  return DATE_REGEX.test(text)
}
