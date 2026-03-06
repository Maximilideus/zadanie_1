import type { Context } from "grammy"
import { InlineKeyboard } from "grammy"
import {
  getServices,
  getMasters,
  getAvailability,
  setBookingService,
  setBookingMaster,
  setBookingTime,
  ensureActiveBooking,
  type ServiceItem,
} from "../api/backend.client.js"
import {
  formatServiceDisplayName,
  formatServiceButtonLabel,
  formatBookingDate,
  formatBookingTime,
  formatBookingSummary,
  formatMasterDisplayName,
} from "../services/formatters.js"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const MAX_SLOT_BUTTONS = 24
const SLOTS_PER_ROW = 3
const SERVICE_BUTTONS_PER_ROW = 2
const MASTER_BUTTONS_PER_ROW = 2
const DAYS_BUTTONS_PER_ROW = 2
const DATE_DAYS_SHOWN = 14
const DATE_RANGE_DAYS = 60
const SALON_TIMEZONE = "Europe/Berlin"

const NO_PENDING_MESSAGE = "No active PENDING booking"

function todayStrInSalonTz(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: SALON_TIMEZONE })
}

function dateStrInSalonTz(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: SALON_TIMEZONE })
}

export interface BookingSession {
  serviceId?: string
  masterId?: string
  dateStr?: string
  timeStr?: string
  serviceName?: string
  masterName?: string
  durationMin?: number
  wizardMessageId?: { chatId: number; messageId: number }
  awaitingDate?: boolean
}

const sessionStore = new Map<number, BookingSession>()

export function getBookingSession(telegramId: number): BookingSession {
  return sessionStore.get(telegramId) ?? {}
}

export function setBookingSession(
  telegramId: number,
  data: Partial<BookingSession>
): void {
  const current = sessionStore.get(telegramId) ?? {}
  sessionStore.set(telegramId, { ...current, ...data })
}

export function clearBookingSession(telegramId: number): void {
  sessionStore.delete(telegramId)
}

function buildSummary(session: BookingSession): string {
  const s = session.serviceName ?? "—"
  const m = session.masterName ?? "—"
  const d = session.dateStr ? formatBookingDate(session.dateStr + "T12:00:00Z") : "—"
  const t = session.timeStr ?? "—"
  return [
    "Услуга: " + s,
    "Мастер: " + m,
    "Дата: " + d,
    "Время: " + t,
  ].join("\n")
}

function isNoPendingError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : ""
  return msg.includes(NO_PENDING_MESSAGE) || msg.includes("NO_PENDING")
}

async function ensureBookingAndRetry<T>(
  telegramId: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (!isNoPendingError(e)) throw e
    console.log("[wizard] 409 no active booking, ensuring booking and retrying")
    await ensureActiveBooking(telegramId)
    return fn()
  }
}

function serviceButtonLabel(s: ServiceItem): string {
  return formatServiceButtonLabel(s)
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

/** Next 14 days starting from tomorrow (booking on current day not allowed). */
function getNext14Days(): { date: string; label: string }[] {
  const out: { date: string; label: string }[] = []
  const todayStr = todayStrInSalonTz()
  for (let i = 1; i <= DATE_DAYS_SHOWN; i++) {
    const d = new Date(todayStr + "T12:00:00Z")
    d.setUTCDate(d.getUTCDate() + i)
    const date = dateStrInSalonTz(d)
    const label = d.toLocaleDateString("ru-RU", {
      timeZone: SALON_TIMEZONE,
      weekday: "short",
      month: "2-digit",
      day: "2-digit",
    })
    out.push({ date, label })
  }
  return out
}

/** Date must be after today and within 60 days (no same-day booking). */
function isDateInRange(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) return false
  const todayStr = todayStrInSalonTz()
  const maxD = new Date(todayStr + "T12:00:00Z")
  maxD.setUTCDate(maxD.getUTCDate() + DATE_RANGE_DAYS)
  const maxStr = dateStrInSalonTz(maxD)
  return dateStr > todayStr && dateStr <= maxStr
}

function getChatId(ctx: Context): number | undefined {
  return ctx.chat?.id ?? ctx.callbackQuery?.message?.chat?.id
}

async function editWizardMessage(
  ctx: Context,
  session: BookingSession,
  text: string,
  keyboard: InlineKeyboard
): Promise<void> {
  const fromId = ctx.from?.id
  if (fromId === undefined) return
  const w = session.wizardMessageId
  if (w) {
    try {
      await ctx.api.editMessageText(w.chatId, w.messageId, text, {
        reply_markup: keyboard,
      })
    } catch (editErr) {
      console.log("[wizard] editMessageText failed, sending new message", editErr)
      const chatId = getChatId(ctx)
      if (!chatId) return
      const sent = await ctx.api.sendMessage(chatId, text, {
        reply_markup: keyboard,
      })
      setBookingSession(fromId, {
        wizardMessageId: { chatId: sent.chat.id, messageId: sent.message_id },
      })
    }
  } else {
    const chatId = getChatId(ctx)
    if (!chatId) return
    const sent = await ctx.api.sendMessage(chatId, text, {
      reply_markup: keyboard,
    })
    setBookingSession(fromId, {
      wizardMessageId: { chatId: sent.chat.id, messageId: sent.message_id },
    })
  }
}

/**
 * Start wizard with a pre-selected service (from deep link).
 * Skips the service selection step and goes straight to master selection.
 */
export async function startWizardWithService(
  ctx: Context,
  serviceId: string,
  serviceName: string,
  durationMin: number | undefined,
  introText: string,
): Promise<void> {
  const from = ctx.from
  if (!from) return
  const telegramId = String(from.id)

  await ensureActiveBooking(telegramId)
  clearBookingSession(from.id)

  try {
    await ensureBookingAndRetry(telegramId, () =>
      setBookingService(telegramId, serviceId)
    )
  } catch {
    const session = getBookingSession(from.id)
    await editWizardMessage(
      ctx,
      session,
      "Не удалось начать запись. Попробуйте /book",
      new InlineKeyboard()
    )
    return
  }

  setBookingSession(from.id, { serviceId, serviceName, durationMin })

  const masters = await getMasters(serviceId)
  if (masters.length === 0) {
    const text = introText + "\n\nНет доступных мастеров для этой услуги."
    const sent = await ctx.reply(text)
    setBookingSession(from.id, {
      wizardMessageId: { chatId: sent.chat.id, messageId: sent.message_id },
    })
    return
  }

  const keyboard = new InlineKeyboard()
  for (let i = 0; i < masters.length; i++) {
    keyboard.text(formatMasterDisplayName(masters[i]), `mst:${masters[i].id}`)
    if ((i + 1) % MASTER_BUTTONS_PER_ROW === 0) keyboard.row()
  }
  const text = introText + "\n\nВыберите мастера:"
  const sent = await ctx.reply(text, { reply_markup: keyboard })
  setBookingSession(from.id, {
    wizardMessageId: { chatId: sent.chat.id, messageId: sent.message_id },
  })
}

/** Start or resume wizard: ensure booking, show single wizard message (step A or current step). */
export async function startWizard(ctx: Context): Promise<void> {
  const from = ctx.from
  if (!from) return
  const telegramId = String(from.id)

  await ensureActiveBooking(telegramId)
  const session = getBookingSession(from.id)
  const summary = buildSummary(session)
  const services = await getServices()
  if (services.length === 0) {
    const text = summary + "\n\nНет доступных услуг."
    const sent = await ctx.reply(text)
    setBookingSession(from.id, {
      wizardMessageId: { chatId: sent.chat.id, messageId: sent.message_id },
    })
    return
  }

  const keyboard = new InlineKeyboard()
  for (let i = 0; i < services.length; i++) {
    keyboard.text(serviceButtonLabel(services[i]), `svc:${services[i].id}`)
    if ((i + 1) % SERVICE_BUTTONS_PER_ROW === 0) keyboard.row()
  }
  const text = summary + "\n\nВыберите услугу:"
  await editWizardMessage(ctx, session, text, keyboard)
}

/** Called from booking handler: ensure we have a wizard message and show step A. */
export async function showServiceList(ctx: Context): Promise<void> {
  const from = ctx.from
  if (!from) return
  const session = getBookingSession(from.id)
  const summary = buildSummary(session)
  const services = await getServices()
  if (services.length === 0) {
    await editWizardMessage(
      ctx,
      session,
      summary + "\n\nНет доступных услуг.",
      new InlineKeyboard()
    )
    return
  }
  const keyboard = new InlineKeyboard()
  for (let i = 0; i < services.length; i++) {
    keyboard.text(serviceButtonLabel(services[i]), `svc:${services[i].id}`)
    if ((i + 1) % SERVICE_BUTTONS_PER_ROW === 0) keyboard.row()
  }
  await editWizardMessage(ctx, session, summary + "\n\nВыберите услугу:", keyboard)
}

export async function onServiceChosen(ctx: Context, serviceId: string): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  const tid = String(telegramId)
  const session = getBookingSession(telegramId)

  try {
    let serviceName = ""
    try {
      await ensureBookingAndRetry(tid, () => setBookingService(tid, serviceId))
      const services = await getServices()
      const s = services.find((x) => x.id === serviceId)
      serviceName = s ? formatServiceDisplayName(s) : "—"
      setBookingSession(telegramId, { serviceId, serviceName, durationMin: s?.durationMin })
    } catch (e) {
      await handleBackendError(ctx, e, session)
      return
    }

    console.log("[wizard] step: service chosen", serviceId)

    const masters = await getMasters(serviceId)
    if (masters.length === 0) {
      const text = buildSummary(getBookingSession(telegramId)) + "\n\nНет доступных мастеров для этой услуги."
      await editWizardMessage(ctx, getBookingSession(telegramId), text, new InlineKeyboard())
      return
    }

    const keyboard = new InlineKeyboard()
    for (let i = 0; i < masters.length; i++) {
      keyboard.text(formatMasterDisplayName(masters[i]), `mst:${masters[i].id}`)
      if ((i + 1) % MASTER_BUTTONS_PER_ROW === 0) keyboard.row()
    }
    const text = buildSummary(getBookingSession(telegramId)) + "\n\nВыберите мастера:"
    await editWizardMessage(ctx, getBookingSession(telegramId), text, keyboard)
  } catch (e) {
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true }).catch(() => {})
    await handleBackendError(ctx, e, session)
  }
}

export async function onMasterChosen(ctx: Context, masterId: string): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  const tid = String(telegramId)
  const session = getBookingSession(telegramId)
  const serviceId = session.serviceId
  if (!serviceId) {
    await ctx.answerCallbackQuery({ text: "Сначала выберите услугу." })
    return
  }

  try {
    try {
      await ensureBookingAndRetry(tid, () => setBookingMaster(tid, masterId))
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("Master cannot perform") || msg.includes("MASTER_CANNOT")) {
        await ctx.answerCallbackQuery({
          text: "Этот мастер не выполняет выбранную услугу.",
          show_alert: true,
        })
        const masters = await getMasters(serviceId)
        const keyboard = new InlineKeyboard()
        for (let i = 0; i < masters.length; i++) {
          keyboard.text(formatMasterDisplayName(masters[i]), `mst:${masters[i].id}`)
          if ((i + 1) % MASTER_BUTTONS_PER_ROW === 0) keyboard.row()
        }
        const text = buildSummary(session) + "\n\nВыберите мастера:"
        await editWizardMessage(ctx, session, text, keyboard)
        return
      }
      await handleBackendError(ctx, e, session)
      return
    }

    const masters = await getMasters(serviceId)
    const master = masters.find((m) => m.id === masterId)
    setBookingSession(telegramId, {
      masterId,
      masterName: master ? formatMasterDisplayName(master) : "—",
    })
    console.log("[wizard] step: master chosen", masterId)

    const days = getNext14Days()
    const keyboard = new InlineKeyboard()
    for (let i = 0; i < days.length; i++) {
      keyboard.text(days[i].label, `day:${days[i].date}`)
      if ((i + 1) % DAYS_BUTTONS_PER_ROW === 0) keyboard.row()
    }
    keyboard.row().text("📅 Ввести дату", "manual_date")
    const text = buildSummary(getBookingSession(telegramId)) + "\n\nВыберите дату:"
    await editWizardMessage(ctx, getBookingSession(telegramId), text, keyboard)
  } catch (e) {
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true }).catch(() => {})
    await handleBackendError(ctx, e, session)
  }
}

export async function onDayChosen(ctx: Context, dateStr: string): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  const session = getBookingSession(telegramId)
  const serviceId = session.serviceId
  const masterId = session.masterId
  if (!serviceId || !masterId) {
    await ctx.answerCallbackQuery({ text: "Сначала выберите услугу и мастера." })
    return
  }

  try {
    setBookingSession(telegramId, { dateStr, awaitingDate: false })
    console.log("[wizard] step: date chosen", dateStr)

    const { timezone, slots } = await getAvailability(serviceId, masterId, dateStr)
    if (slots.length === 0) {
      const days = getNext14Days()
      const keyboard = new InlineKeyboard()
      for (let i = 0; i < days.length; i++) {
        keyboard.text(days[i].label, `day:${days[i].date}`)
        if ((i + 1) % DAYS_BUTTONS_PER_ROW === 0) keyboard.row()
      }
      keyboard.row().text("📅 Ввести дату", "manual_date")
      const text =
        buildSummary(getBookingSession(telegramId)) +
        "\n\nНа эту дату нет слотов. Выберите другую дату:"
      await editWizardMessage(ctx, getBookingSession(telegramId), text, keyboard)
      return
    }

    const toShow = slots.slice(0, MAX_SLOT_BUTTONS)
    const keyboard = new InlineKeyboard()
    for (let i = 0; i < toShow.length; i++) {
      keyboard.text(slotLabel(toShow[i], timezone), `t:${toShow[i]}`)
      if ((i + 1) % SLOTS_PER_ROW === 0) keyboard.row()
    }
    const text = buildSummary(getBookingSession(telegramId)) + "\n\nВыберите время:"
    await editWizardMessage(ctx, getBookingSession(telegramId), text, keyboard)
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : ""
    const isToday = errMsg.includes("DATE_IS_TODAY") || errMsg.includes("current day")
    await ctx.answerCallbackQuery({
      text: isToday
        ? "Запись на сегодня недоступна. Пожалуйста, выберите другую дату."
        : "Не удалось загрузить слоты. Попробуйте другую дату.",
      show_alert: true,
    }).catch(() => {})
    const days = getNext14Days()
    const keyboard = new InlineKeyboard()
    for (let i = 0; i < days.length; i++) {
      keyboard.text(days[i].label, `day:${days[i].date}`)
      if ((i + 1) % DAYS_BUTTONS_PER_ROW === 0) keyboard.row()
    }
    keyboard.row().text("📅 Ввести дату", "manual_date")
    const text =
      buildSummary(getBookingSession(telegramId)) +
      "\n\n" +
      (isToday
        ? "Запись на сегодня недоступна. Пожалуйста, выберите другую дату."
        : "Выберите дату (от завтра до 60 дней):")
    await editWizardMessage(ctx, getBookingSession(telegramId), text, keyboard)
  }
}

export async function onManualDateChosen(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  try {
    setBookingSession(telegramId, { awaitingDate: true })
    const session = getBookingSession(telegramId)
    const text =
      buildSummary(session) +
      "\n\nВведите дату в формате ГГГГ-ММ-ДД (например 2026-05-15):"
    await editWizardMessage(ctx, session, text, new InlineKeyboard())
  } catch (e) {
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true }).catch(() => {})
  }
}

export async function onDateEntered(
  ctx: Context,
  dateStr: string,
  serviceId: string,
  masterId: string
): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return

  if (!DATE_REGEX.test(dateStr)) {
    const session = getBookingSession(telegramId)
    const text =
      buildSummary(session) +
      "\n\nНеверный формат. Введите дату ГГГГ-ММ-ДД (например 2025-06-15):"
    await editWizardMessage(ctx, session, text, new InlineKeyboard())
    return
  }
  if (!isDateInRange(dateStr)) {
    const session = getBookingSession(telegramId)
    const todayStr = todayStrInSalonTz()
    const isToday = dateStr === todayStr
    const text =
      buildSummary(session) +
      "\n\n" +
      (isToday
        ? "Запись на сегодня недоступна. Пожалуйста, выберите другую дату (ГГГГ-ММ-ДД)."
        : "Дата должна быть от завтра до 60 дней вперёд. Введите ГГГГ-ММ-ДД:")
    await editWizardMessage(ctx, session, text, new InlineKeyboard())
    return
  }

  setBookingSession(telegramId, { dateStr, awaitingDate: false })
  console.log("[wizard] step: date entered manually", dateStr)

  const session = getBookingSession(telegramId)
  const { timezone, slots } = await getAvailability(serviceId, masterId, dateStr)
  if (slots.length === 0) {
    const days = getNext14Days()
    const keyboard = new InlineKeyboard()
    for (let i = 0; i < days.length; i++) {
      keyboard.text(days[i].label, `day:${days[i].date}`)
      if ((i + 1) % DAYS_BUTTONS_PER_ROW === 0) keyboard.row()
    }
    keyboard.row().text("📅 Ввести дату", "manual_date")
    const text =
      buildSummary(getBookingSession(telegramId)) +
      "\n\nНа эту дату нет слотов. Выберите дату:"
    await editWizardMessage(ctx, getBookingSession(telegramId), text, keyboard)
    return
  }

  const toShow = slots.slice(0, MAX_SLOT_BUTTONS)
  const keyboard = new InlineKeyboard()
  for (let i = 0; i < toShow.length; i++) {
    keyboard.text(slotLabel(toShow[i], timezone), `t:${toShow[i]}`)
    if ((i + 1) % SLOTS_PER_ROW === 0) keyboard.row()
  }
  const text = buildSummary(getBookingSession(telegramId)) + "\n\nВыберите время:"
  await editWizardMessage(ctx, getBookingSession(telegramId), text, keyboard)
}

/** Show confirmation screen; booking is created only after user confirms. */
export async function onTimeSlotChosen(ctx: Context, scheduledAtIso: string): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  const session = getBookingSession(telegramId)
  const { serviceName, masterName, dateStr, durationMin } = session
  if (!dateStr) return

  try {
    const timeStr = formatBookingTime(scheduledAtIso)
    setBookingSession(telegramId, { timeStr })
    const duration = durationMin != null ? `${durationMin} мин` : "—"
    const confirmText =
      "Подтвердите запись:\n\n" +
      `Услуга: ${serviceName ?? "—"}\n` +
      `Мастер: ${masterName ?? "—"}\n` +
      `Дата: ${formatBookingDate(dateStr + "T12:00:00Z")}\n` +
      `Время: ${timeStr}\n` +
      `Длительность: ${duration}\n\n` +
      "Если нужно изменить дату или время, нажмите «Назад»."
    const keyboard = new InlineKeyboard()
      .text("Подтвердить запись", `confirm:${scheduledAtIso}`)
      .row()
      .text("Назад", "time_back")
    await editWizardMessage(ctx, getBookingSession(telegramId), confirmText, keyboard)
  } catch (e) {
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true }).catch(() => {})
    await handleBackendError(ctx, e, session)
  }
}

/** User confirmed: create booking (set time on backend) and show success. */
export async function onConfirmBooking(ctx: Context, scheduledAtIso: string): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  const tid = String(telegramId)
  const session = getBookingSession(telegramId)

  try {
    await ensureBookingAndRetry(tid, () => setBookingTime(tid, scheduledAtIso))
  } catch (e) {
    await handleBackendError(ctx, e, session)
    return
  }
  const summary = formatBookingSummary({
    serviceDisplayName: session.serviceName ?? "—",
    masterName: session.masterName ?? "—",
    scheduledAt: scheduledAtIso,
  })
  clearBookingSession(telegramId)
  console.log("[wizard] step: booking confirmed and created")
  await ctx.editMessageText(
    "✅ Заявка на запись создана.\n\n" +
      `Услуга: ${summary.service}\n` +
      `Мастер: ${summary.master}\n` +
      `Дата: ${summary.date}\n` +
      `Время: ${summary.time}\n\n` +
      "Проверить записи: /my_bookings"
  )
}

/** User pressed Back: return to DATE selection (not time). */
export async function onTimeBack(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  const session = getBookingSession(telegramId)
  const { masterId } = session
  if (!masterId) return
  try {
    setBookingSession(telegramId, { timeStr: undefined })
    const days = getNext14Days()
    const keyboard = new InlineKeyboard()
    for (let i = 0; i < days.length; i++) {
      keyboard.text(days[i].label, `day:${days[i].date}`)
      if ((i + 1) % DAYS_BUTTONS_PER_ROW === 0) keyboard.row()
    }
    keyboard.row().text("📅 Ввести дату", "manual_date")
    const text = buildSummary(getBookingSession(telegramId)) + "\n\nВыберите дату:"
    await editWizardMessage(ctx, getBookingSession(telegramId), text, keyboard)
  } catch (e) {
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true }).catch(() => {})
    await handleBackendError(ctx, e, session)
  }
}

async function handleBackendError(
  ctx: Context,
  e: unknown,
  session: BookingSession
): Promise<void> {
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
    text = "Введите дату в диапазоне от завтра до 60 дней вперёд (ГГГГ-ММ-ДД)."
  } else if (msg.includes("DATE_IS_TODAY") || msg.includes("current day")) {
    text = "Запись на сегодня недоступна. Пожалуйста, выберите другую дату."
  }
  try {
    const full = buildSummary(session) + "\n\n" + text
    await editWizardMessage(ctx, session, full, new InlineKeyboard())
  } catch {
    await ctx.reply(text).catch(() => {})
  }
}

export function isDateString(text: string): boolean {
  return DATE_REGEX.test(text)
}
