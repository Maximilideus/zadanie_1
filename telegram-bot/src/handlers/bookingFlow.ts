import type { Context } from "grammy"
import { InlineKeyboard } from "grammy"
import {
  getServices,
  getMasters,
  getAvailability,
  getMasterWorkingDays,
  getMasterBlockedDates,
  setBookingService,
  setBookingMaster,
  setBookingTime,
  ensureActiveBooking,
  updateTelegramState,
  rescheduleBooking,
  getUpcomingBookings,
  type ServiceItem,
  type UpcomingBookingItem,
} from "../api/backend.client.js"
import {
  formatServiceDisplayName,
  formatServiceNameOnly,
  formatServiceButtonLabel,
  formatBookingDate,
  formatBookingTime,
  formatBookingCard,
  formatBookingCardFromParts,
  formatMasterDisplayName,
  stripTrailingDuration,
} from "../services/formatters.js"
import type { ConfirmState } from "../session/bookingFlowSession.js"
import { SALON_TIMEZONE } from "../config/salon.js"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const MAX_SLOT_BUTTONS = 24
const SLOTS_PER_ROW = 3
const SERVICE_BUTTONS_PER_ROW = 2
const MASTER_BUTTONS_PER_ROW = 2
const DAYS_BUTTONS_PER_ROW = 2
const DATE_DAYS_SHOWN = 14
const DATE_RANGE_DAYS = 60

const NO_SLOTS_ON_DATE_MESSAGE =
  "К сожалению, этот мастер в выбранную дату не принимает.\n\n" +
  "Выберите другую дату из доступных ниже.\n" +
  "Если ни одна дата не подходит, можно вернуться назад и выбрать другого мастера."

function todayStrInSalonTz(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: SALON_TIMEZONE })
}

function dateStrInSalonTz(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: SALON_TIMEZONE })
}

export type WizardStep = "catalog" | "master" | "date" | "time" | "confirm"

export interface BookingSession {
  step?: WizardStep
  category?: string
  serviceId?: string
  masterId?: string
  dateStr?: string
  timeStr?: string
  scheduledAtIso?: string
  serviceName?: string
  masterName?: string
  durationMin?: number
  price?: number
  catalogTitle?: string
  catalogGender?: string
  catalogGroupKey?: string
  catalogElectroZone?: string
  wizardMessageId?: { chatId: number; messageId: number }
  awaitingDate?: boolean
  confirm?: ConfirmState
  /** Set when in reschedule flow: the booking to replace */
  rescheduleBookingId?: string
  /** One-line summary of the current booking (for reschedule confirm screen) */
  rescheduleOldSummary?: string
}

const CATEGORY_SERVICE_PREFIX: Record<string, string> = {
  LASER: "Laser",
  WAX: "Waxing",
  ELECTRO: "Electro",
  MASSAGE: "Massage",
}

function filterServicesByCategory(services: ServiceItem[], category?: string): ServiceItem[] {
  if (!category) return services
  const prefix = CATEGORY_SERVICE_PREFIX[category]
  if (!prefix) return services
  return services.filter((s) => s.name.startsWith(prefix))
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

const EMPTY_CONFIRM_STATE: ConfirmState = {
  inProgress: false,
  idempotencyKey: null,
  lastAttemptAt: null,
}

function getConfirmState(session: BookingSession): ConfirmState {
  return session.confirm ?? EMPTY_CONFIRM_STATE
}

function isSessionReadyForConfirm(session: BookingSession): boolean {
  return !!(session.serviceId && session.masterId && session.dateStr && session.timeStr)
}

function buildSummary(session: BookingSession): string {
  return formatBookingCardFromParts({
    serviceName: stripTrailingDuration(session.serviceName ?? "—"),
    zone: session.catalogElectroZone ?? session.catalogTitle,
    durationMin: session.durationMin,
    masterName: session.masterName ?? "—",
    date: session.dateStr ? formatBookingDate(session.dateStr + "T12:00:00Z") : "—",
    time: session.timeStr ?? "—",
  })
}

function serviceButtonLabel(s: ServiceItem): string {
  return formatServiceButtonLabel(s)
}

function slotLabel(isoUtc: string): string {
  const date = new Date(isoUtc)
  return date.toLocaleTimeString("ru-RU", {
    timeZone: SALON_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

/** ISO weekday (1–7) for a date string in salon TZ. Matches backend Luxon weekday. */
const WEEKDAY_NAMES: Record<string, number> = {
  Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7,
}
function getWeekdayInSalonTz(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00Z")
  const name = d.toLocaleDateString("en-US", { timeZone: SALON_TIMEZONE, weekday: "long" })
  return WEEKDAY_NAMES[name] ?? 1
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

/** Next dates (up to DATE_DAYS_SHOWN) that fall on the master's working weekdays and are not blocked. */
async function getNext14DaysForMaster(masterId: string): Promise<{ date: string; label: string }[]> {
  const [dayOfWeeks, blockedSet] = await Promise.all([
    getMasterWorkingDays(masterId),
    (async () => {
      const todayStr = todayStrInSalonTz()
      const toD = new Date(todayStr + "T12:00:00Z")
      toD.setUTCDate(toD.getUTCDate() + DATE_RANGE_DAYS)
      const toStr = dateStrInSalonTz(toD)
      const fromStr = new Date(todayStr + "T12:00:00Z")
      fromStr.setUTCDate(fromStr.getUTCDate() + 1)
      const from = dateStrInSalonTz(fromStr)
      const dates = await getMasterBlockedDates(masterId, from, toStr)
      return new Set(dates)
    })(),
  ])
  if (dayOfWeeks.length === 0) return []
  const todayStr = todayStrInSalonTz()
  const candidates: { date: string; label: string }[] = []
  for (let i = 1; i <= DATE_RANGE_DAYS && candidates.length < DATE_DAYS_SHOWN; i++) {
    const d = new Date(todayStr + "T12:00:00Z")
    d.setUTCDate(d.getUTCDate() + i)
    const date = dateStrInSalonTz(d)
    if (blockedSet.has(date)) continue
    const wd = getWeekdayInSalonTz(date)
    if (dayOfWeeks.includes(wd)) {
      const label = d.toLocaleDateString("ru-RU", {
        timeZone: SALON_TIMEZONE,
        weekday: "short",
        month: "2-digit",
        day: "2-digit",
      })
      candidates.push({ date, label })
    }
  }
  return candidates
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
  extra?: {
    price?: number
    catalogTitle?: string
    category?: string
    catalogGender?: string
    catalogGroupKey?: string
    catalogElectroZone?: string
  },
): Promise<void> {
  const from = ctx.from
  if (!from) return

  const prev = getBookingSession(from.id)
  clearBookingSession(from.id)

  setBookingSession(from.id, {
    category: extra?.category ?? prev.category,
    serviceId,
    serviceName,
    durationMin,
    price: extra?.price ?? undefined,
    catalogTitle: extra?.catalogTitle ?? undefined,
    catalogGender: extra?.catalogGender ?? prev.catalogGender,
    catalogGroupKey: extra?.catalogGroupKey ?? prev.catalogGroupKey,
    catalogElectroZone: extra?.catalogElectroZone ?? prev.catalogElectroZone,
  })

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
    step: "master",
    wizardMessageId: { chatId: sent.chat.id, messageId: sent.message_id },
  })
}

/**
 * Start reschedule wizard from an existing booking.
 * Keeps service; user chooses new master, date, time. Ends with reschedule API call.
 */
export async function startRescheduleWizard(
  ctx: Context,
  booking: UpcomingBookingItem,
): Promise<void> {
  const from = ctx.from
  if (!from) return

  if (!booking.serviceId) {
    await ctx.answerCallbackQuery({
      text: "Не удалось начать перенос: у записи не указана услуга.",
      show_alert: true,
    }).catch(() => {})
    return
  }

  const rescheduleOldSummary = formatBookingCard({
    service: { ...booking.service, zone: undefined },
    masterName: booking.masterName,
    scheduledAt: booking.scheduledAt,
  })

  clearBookingSession(from.id)
  setBookingSession(from.id, {
    rescheduleBookingId: booking.id,
    serviceId: booking.serviceId,
    serviceName: formatServiceDisplayName(booking.service),
    durationMin: booking.service.durationMin,
    rescheduleOldSummary,
    step: "master",
  })

  const masters = await getMasters(booking.serviceId)
  if (masters.length === 0) {
    const text =
      "Перенос записи.\n\n" +
      formatBookingCard({ service: { ...booking.service, zone: undefined }, masterName: booking.masterName, scheduledAt: booking.scheduledAt }) +
      "\n\nНет доступных мастеров для этой услуги."
    const msg = ctx.callbackQuery?.message
    if (msg && "chat" in msg && "message_id" in msg) {
      await ctx.api.editMessageText(msg.chat.id, msg.message_id, text).catch(() => {})
    }
    await ctx.answerCallbackQuery().catch(() => {})
    return
  }

  const keyboard = new InlineKeyboard()
  for (let i = 0; i < masters.length; i++) {
    keyboard.text(formatMasterDisplayName(masters[i]), `mst:${masters[i].id}`)
    if ((i + 1) % MASTER_BUTTONS_PER_ROW === 0) keyboard.row()
  }

  const text =
    "Перенос записи.\n\n" +
    formatBookingCard({ service: { ...booking.service, zone: undefined }, masterName: booking.masterName, scheduledAt: booking.scheduledAt }) +
    "\n\nВыберите мастера:"

  const msg = ctx.callbackQuery?.message
  if (msg && "chat" in msg && "message_id" in msg) {
    setBookingSession(from.id, {
      wizardMessageId: { chatId: msg.chat.id, messageId: msg.message_id },
    })
    await ctx.api.editMessageText(msg.chat.id, msg.message_id, text, {
      reply_markup: keyboard,
    }).catch(() => {})
  }
  await ctx.answerCallbackQuery().catch(() => {})
}

/** Start or resume wizard: ensure booking, show single wizard message (step A or current step). */
export async function startWizard(ctx: Context): Promise<void> {
  const from = ctx.from
  if (!from) return

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
export async function showServiceList(ctx: Context, category?: string): Promise<void> {
  const from = ctx.from
  if (!from) return
  const session = getBookingSession(from.id)
  const summary = buildSummary(session)
  const allServices = await getServices()
  const services = filterServicesByCategory(allServices, category)
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
  const session = getBookingSession(telegramId)

  try {
    const services = await getServices()
    const s = services.find((x) => x.id === serviceId)
    const serviceName = s ? formatServiceDisplayName(s) : "—"
    setBookingSession(telegramId, { serviceId, serviceName, durationMin: s?.durationMin })

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
    setBookingSession(telegramId, { step: "master" })
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
  const session = getBookingSession(telegramId)
  const serviceId = session.serviceId
  if (!serviceId) {
    await ctx.answerCallbackQuery({ text: "Сначала выберите услугу." })
    return
  }

  try {
    const masters = await getMasters(serviceId)
    const master = masters.find((m) => m.id === masterId)
    if (!master) {
      await ctx.answerCallbackQuery({
        text: "Этот специалист сейчас недоступен. Пожалуйста, выберите другого мастера.",
        show_alert: true,
      }).catch(() => {})
      const keyboard = new InlineKeyboard()
      for (let i = 0; i < masters.length; i++) {
        keyboard.text(formatMasterDisplayName(masters[i]), `mst:${masters[i].id}`)
        if ((i + 1) % MASTER_BUTTONS_PER_ROW === 0) keyboard.row()
      }
      const text = buildSummary(getBookingSession(telegramId)) + "\n\nЭтот специалист сейчас недоступен. Выберите мастера:"
      await editWizardMessage(ctx, getBookingSession(telegramId), text, keyboard)
      return
    }
    setBookingSession(telegramId, {
      masterId,
      masterName: formatMasterDisplayName(master),
      step: "date",
    })
    console.log("[wizard] step: master chosen", masterId)

    const days = await getNext14DaysForMaster(masterId)
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
      setBookingSession(telegramId, { step: "date" })
      const days = await getNext14DaysForMaster(masterId)
      const keyboard = new InlineKeyboard()
      for (let i = 0; i < days.length; i++) {
        keyboard.text(days[i].label, `day:${days[i].date}`)
        if ((i + 1) % DAYS_BUTTONS_PER_ROW === 0) keyboard.row()
      }
      keyboard.row().text("📅 Ввести дату", "manual_date")
      const text =
        buildSummary(getBookingSession(telegramId)) + "\n\n" + NO_SLOTS_ON_DATE_MESSAGE
      await editWizardMessage(ctx, getBookingSession(telegramId), text, keyboard)
      return
    }

    setBookingSession(telegramId, { step: "time" })
    const toShow = slots.slice(0, MAX_SLOT_BUTTONS)
    const keyboard = new InlineKeyboard()
    for (let i = 0; i < toShow.length; i++) {
      keyboard.text(slotLabel(toShow[i]), `t:${toShow[i]}`)
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
    const days = await getNext14DaysForMaster(masterId)
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
    setBookingSession(telegramId, { step: "date" })
    const days = await getNext14DaysForMaster(masterId)
    const keyboard = new InlineKeyboard()
    for (let i = 0; i < days.length; i++) {
      keyboard.text(days[i].label, `day:${days[i].date}`)
      if ((i + 1) % DAYS_BUTTONS_PER_ROW === 0) keyboard.row()
    }
    keyboard.row().text("📅 Ввести дату", "manual_date")
    const text =
      buildSummary(getBookingSession(telegramId)) + "\n\n" + NO_SLOTS_ON_DATE_MESSAGE
    await editWizardMessage(ctx, getBookingSession(telegramId), text, keyboard)
    return
  }

  setBookingSession(telegramId, { step: "time" })
  const toShow = slots.slice(0, MAX_SLOT_BUTTONS)
  const keyboard = new InlineKeyboard()
  for (let i = 0; i < toShow.length; i++) {
    keyboard.text(slotLabel(toShow[i]), `t:${toShow[i]}`)
    if ((i + 1) % SLOTS_PER_ROW === 0) keyboard.row()
  }
  const text = buildSummary(getBookingSession(telegramId)) + "\n\nВыберите время:"
  await editWizardMessage(ctx, getBookingSession(telegramId), text, keyboard)
}

/** After time slot selected: validate session, then show confirm screen. */
export async function onTimeSlotChosen(ctx: Context, scheduledAtIso: string): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  const session = getBookingSession(telegramId)

  if (!session.serviceId || !session.masterId || !session.dateStr) {
    await ctx.answerCallbackQuery({
      text: "Данные записи неполны. Начните заново: /book",
      show_alert: true,
    }).catch(() => {})
    return
  }

  try {
    const timeStr = formatBookingTime(scheduledAtIso)
    setBookingSession(telegramId, {
      step: "confirm",
      timeStr,
      scheduledAtIso,
      confirm: { ...EMPTY_CONFIRM_STATE },
    })
    if (session.rescheduleBookingId) {
      await showRescheduleConfirmScreen(ctx, telegramId, scheduledAtIso)
    } else {
      await showConfirmScreen(ctx, telegramId, scheduledAtIso)
    }
  } catch (e) {
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true }).catch(() => {})
    await handleBackendError(ctx, e, session)
  }
}

function buildConfirmText(session: BookingSession): string {
  const card = formatBookingCardFromParts({
    serviceName: stripTrailingDuration(session.serviceName ?? "—"),
    zone: session.catalogElectroZone ?? session.catalogTitle,
    durationMin: session.durationMin,
    masterName: session.masterName ?? "—",
    date: session.dateStr ? formatBookingDate(session.dateStr + "T12:00:00Z") : "—",
    time: session.timeStr ?? "—",
  })
  const lines = ["Проверьте данные записи\n", card]
  if (session.price != null) lines.push("", `Цена: ${session.price} ₽`)
  lines.push("", "Запись будет создана и ожидать подтверждения салоном.")
  lines.push("После подтверждения изменить время или мастера нельзя — только отменить и оформить заново.")
  return lines.join("\n")
}

function buildConfirmKeyboard(scheduledAtIso: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Подтвердить запись", `confirm:${scheduledAtIso}`)
    .row()
    .text("🕒 Другое время", "edit_time")
    .text("📅 Другая дата", "edit_date")
    .row()
    .text("👩 Другой мастер", "edit_master")
    .text("🔄 Другая услуга", "another_service")
    .row()
    .text("❌ Отмена", "cancel_flow")
}

function buildRescheduleConfirmText(session: BookingSession): string {
  const oldPart = "Текущая запись:\n" + (session.rescheduleOldSummary ?? "—")
  const newPart =
    "Новая запись:\n" +
    formatBookingCardFromParts({
      serviceName: stripTrailingDuration(session.serviceName ?? "—"),
      zone: session.catalogElectroZone ?? session.catalogTitle,
      durationMin: session.durationMin,
      masterName: session.masterName ?? "—",
      date: session.dateStr ? formatBookingDate(session.dateStr + "T12:00:00Z") : "—",
      time: session.timeStr ?? "—",
    })
  return "Перенос записи\n\n" + oldPart + "\n\n" + newPart + "\n\nНажмите «Подтвердить перенос», чтобы заменить текущую запись на новую."
}

function buildRescheduleConfirmKeyboard(scheduledAtIso: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Подтвердить перенос", `confirm_reschedule:${scheduledAtIso}`)
    .row()
    .text("🕒 Другое время", "edit_time")
    .text("📅 Другая дата", "edit_date")
    .row()
    .text("👩 Другой мастер", "edit_master")
    .row()
    .text("❌ Отмена", "cancel_flow")
}

async function showRescheduleConfirmScreen(
  ctx: Context,
  telegramId: number,
  scheduledAtIso: string,
): Promise<void> {
  const session = getBookingSession(telegramId)
  const text = buildRescheduleConfirmText(session)
  const keyboard = buildRescheduleConfirmKeyboard(scheduledAtIso)
  await editWizardMessage(ctx, session, text, keyboard)
}

async function showConfirmScreen(ctx: Context, telegramId: number, scheduledAtIso: string): Promise<void> {
  const session = getBookingSession(telegramId)
  const text = buildConfirmText(session)
  const keyboard = buildConfirmKeyboard(scheduledAtIso)
  await editWizardMessage(ctx, session, text, keyboard)
}

/** Re-check availability, then create booking. Protects against duplicates via ConfirmState. */
export async function onConfirmBooking(ctx: Context, scheduledAtIso: string): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  const tid = String(telegramId)
  const session = getBookingSession(telegramId)
  const confirmState = getConfirmState(session)

  if (confirmState.inProgress) {
    await ctx.answerCallbackQuery({ text: "Уже обрабатывается.", show_alert: false }).catch(() => {})
    return
  }

  if (!isSessionReadyForConfirm(session)) {
    await ctx.answerCallbackQuery({ text: "Данные записи неполны. Начните заново: /book", show_alert: true }).catch(() => {})
    return
  }

  const { serviceId, masterId, dateStr } = session as Required<Pick<BookingSession, "serviceId" | "masterId" | "dateStr">>

  setBookingSession(telegramId, {
    confirm: {
      inProgress: true,
      idempotencyKey: scheduledAtIso,
      lastAttemptAt: new Date().toISOString(),
    },
  })

  try {
    const { slots } = await getAvailability(serviceId, masterId, dateStr)
    if (!slots.includes(scheduledAtIso)) {
      setBookingSession(telegramId, {
        timeStr: undefined,
        scheduledAtIso: undefined,
        confirm: { ...EMPTY_CONFIRM_STATE },
      })
      await ctx.answerCallbackQuery({
        text: "К сожалению, это время только что занял другой клиент. Пожалуйста, выберите другое время.",
        show_alert: true,
      }).catch(() => {})
      await showTimeSelection(ctx, telegramId, serviceId, masterId, dateStr,
        "К сожалению, это время только что занял другой клиент. Пожалуйста, выберите другое время:")
      return
    }

    await ensureActiveBooking(tid)
    await setBookingService(tid, serviceId)
    await setBookingMaster(tid, masterId)
    await setBookingTime(tid, scheduledAtIso)
  } catch (e) {
    console.error("[wizard] confirm booking error", e)
    setBookingSession(telegramId, {
      confirm: { ...getConfirmState(getBookingSession(telegramId)), inProgress: false },
    })
    await handleBackendError(ctx, e, session)
    return
  }

  const card = formatBookingCardFromParts({
    serviceName: stripTrailingDuration(session.serviceName ?? "—"),
    zone: session.catalogElectroZone ?? session.catalogTitle,
    durationMin: session.durationMin,
    masterName: session.masterName ?? "—",
    date: formatBookingDate(scheduledAtIso),
    time: formatBookingTime(scheduledAtIso),
  })
  clearBookingSession(telegramId)
  console.log("[wizard] booking confirmed and created")
  await ctx.editMessageText(
    "Запись создана и ожидает подтверждения администратора.\n\n" + card + "\n\nМои записи: /my_bookings"
  )
}

/** Confirm reschedule: call API, on success show new booking; on SLOT_NOT_AVAILABLE return to time selection. */
export async function onConfirmReschedule(ctx: Context, scheduledAtIso: string): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  const tid = String(telegramId)
  const session = getBookingSession(telegramId)

  const bookingId = session.rescheduleBookingId
  const masterId = session.masterId

  if (!bookingId || !masterId || !session.serviceId || !session.dateStr) {
    await ctx.answerCallbackQuery({
      text: "Данные неполны. Начните перенос заново: /my_bookings",
      show_alert: true,
    }).catch(() => {})
    return
  }

  try {
    const newBooking = await rescheduleBooking(tid, bookingId, masterId, scheduledAtIso)
    clearBookingSession(telegramId)

    const newCard = formatBookingCardFromParts({
      serviceName: stripTrailingDuration(session.serviceName ?? "—"),
      zone: session.catalogElectroZone ?? session.catalogTitle,
      durationMin: session.durationMin,
      masterName: session.masterName ?? "—",
      date: newBooking.scheduledAt ? formatBookingDate(newBooking.scheduledAt) : "—",
      time: newBooking.scheduledAt ? formatBookingTime(newBooking.scheduledAt) : "—",
    })

    await ctx.editMessageText(
      "✅ Запись перенесена.\n\nНовая запись:\n" + newCard + "\n\nСтатус: ожидает подтверждения\n\nМои записи: /my_bookings"
    )
    await ctx.answerCallbackQuery().catch(() => {})
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    const isSlotTaken =
      msg.includes("SLOT_NOT_AVAILABLE") ||
      msg.includes("Selected slot is no longer available")
    if (isSlotTaken) {
      setBookingSession(telegramId, {
        timeStr: undefined,
        scheduledAtIso: undefined,
        confirm: { ...EMPTY_CONFIRM_STATE },
      })
      await ctx.answerCallbackQuery({
        text: "К сожалению, это время только что занял другой клиент. Пожалуйста, выберите другое время.",
        show_alert: true,
      }).catch(() => {})
      await showTimeSelection(
        ctx,
        telegramId,
        session.serviceId,
        masterId,
        session.dateStr,
        "К сожалению, это время только что занял другой клиент. Пожалуйста, выберите другое время:"
      )
      return
    }
    if (msg.includes("RESCHEDULE_TOO_LATE")) {
      clearBookingSession(telegramId)
      const bookings = await getUpcomingBookings(tid)
      const booking = bookings.find((b) => b.id === session.rescheduleBookingId)
      const card = booking
        ? formatBookingCard({ service: booking.service, masterName: booking.masterName, scheduledAt: booking.scheduledAt })
        : ""
      const text =
        "⏳ До записи осталось меньше 4 часов\n\n" +
        (card ? card + "\n\n" : "") +
        "Перенести запись можно не позднее чем за 4 часа до начала.\n\n" +
        "Если вам нужно срочно изменить запись, пожалуйста свяжитесь с нами напрямую.\n\n" +
        "Мои записи: /my_bookings"
      await ctx.editMessageText(text)
      await ctx.answerCallbackQuery().catch(() => {})
      return
    }
    await handleBackendError(ctx, e, session)
  }
}

/** Show time slot selection for a given date. Used after confirm-time-unavailable. */
async function showTimeSelection(
  ctx: Context,
  telegramId: number,
  serviceId: string,
  masterId: string,
  dateStr: string,
  headerMessage: string,
): Promise<void> {
  const { timezone, slots } = await getAvailability(serviceId, masterId, dateStr)
  if (slots.length === 0) {
    setBookingSession(telegramId, { step: "date" })
    const days = await getNext14DaysForMaster(masterId)
    const keyboard = new InlineKeyboard()
    for (let i = 0; i < days.length; i++) {
      keyboard.text(days[i].label, `day:${days[i].date}`)
      if ((i + 1) % DAYS_BUTTONS_PER_ROW === 0) keyboard.row()
    }
    keyboard.row().text("📅 Ввести дату", "manual_date")
    const text = buildSummary(getBookingSession(telegramId)) +
      "\n\nНа эту дату нет свободных слотов. Выберите другую дату:"
    await editWizardMessage(ctx, getBookingSession(telegramId), text, keyboard)
    return
  }
  setBookingSession(telegramId, { step: "time" })
  const toShow = slots.slice(0, MAX_SLOT_BUTTONS)
  const keyboard = new InlineKeyboard()
  for (let i = 0; i < toShow.length; i++) {
    keyboard.text(slotLabel(toShow[i]), `t:${toShow[i]}`)
    if ((i + 1) % SLOTS_PER_ROW === 0) keyboard.row()
  }
  const text = buildSummary(getBookingSession(telegramId)) + `\n\n${headerMessage}`
  await editWizardMessage(ctx, getBookingSession(telegramId), text, keyboard)
}

// ── Confirm navigation handlers ──────────────────────────────────────

export async function onEditTime(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  const session = getBookingSession(telegramId)
  const { serviceId, masterId, dateStr } = session
  if (!serviceId || !masterId || !dateStr) return
  setBookingSession(telegramId, {
    timeStr: undefined,
    scheduledAtIso: undefined,
    confirm: { ...EMPTY_CONFIRM_STATE },
  })
  await showTimeSelection(ctx, telegramId, serviceId, masterId, dateStr, "Выберите время:")
}

export async function onEditDate(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  const session = getBookingSession(telegramId)
  setBookingSession(telegramId, {
    step: "date",
    timeStr: undefined,
    scheduledAtIso: undefined,
    dateStr: undefined,
    confirm: { ...EMPTY_CONFIRM_STATE },
  })
  const days = session.masterId
    ? await getNext14DaysForMaster(session.masterId)
    : getNext14Days()
  const keyboard = new InlineKeyboard()
  for (let i = 0; i < days.length; i++) {
    keyboard.text(days[i].label, `day:${days[i].date}`)
    if ((i + 1) % DAYS_BUTTONS_PER_ROW === 0) keyboard.row()
  }
  keyboard.row().text("📅 Ввести дату", "manual_date")
  const text = buildSummary(getBookingSession(telegramId)) + "\n\nВыберите дату:"
  await editWizardMessage(ctx, getBookingSession(telegramId), text, keyboard)
}

export async function onEditMaster(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  const session = getBookingSession(telegramId)
  const { serviceId } = session
  if (!serviceId) return
  setBookingSession(telegramId, {
    masterId: undefined, masterName: undefined,
    dateStr: undefined, timeStr: undefined,
    scheduledAtIso: undefined,
    confirm: { ...EMPTY_CONFIRM_STATE },
  })
  const masters = await getMasters(serviceId)
  if (masters.length === 0) {
    const text = buildSummary(getBookingSession(telegramId)) + "\n\nНет доступных мастеров."
    await editWizardMessage(ctx, getBookingSession(telegramId), text, new InlineKeyboard())
    return
  }
  const keyboard = new InlineKeyboard()
  for (let i = 0; i < masters.length; i++) {
    keyboard.text(formatMasterDisplayName(masters[i]), `mst:${masters[i].id}`)
    if ((i + 1) % MASTER_BUTTONS_PER_ROW === 0) keyboard.row()
  }
  setBookingSession(telegramId, { step: "master" })
  const text = buildSummary(getBookingSession(telegramId)) + "\n\nВыберите мастера:"
  await editWizardMessage(ctx, getBookingSession(telegramId), text, keyboard)
}

export async function onChooseAnotherService(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  // Dynamically import to avoid circular dependency
  const { reenterCategoryContext } = await import("./catalogFlow.js")
  await reenterCategoryContext(ctx)
}

export async function onCancelFlow(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  const wasReschedule = !!getBookingSession(telegramId).rescheduleBookingId
  clearBookingSession(telegramId)
  try {
    await updateTelegramState(String(telegramId), "IDLE")
  } catch {
    // Best-effort: state may already be IDLE (deep link flow never changes it).
  }
  const text = wasReschedule
    ? "Перенос отменён. Ваша запись не изменилась.\n\nМои записи: /my_bookings"
    : "Оформление отменено. Записаться: /book · Консультация: /consult"
  await ctx.editMessageText(text)
}

/** User pressed Back: return to DATE selection (not time). */
export async function onTimeBack(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  const session = getBookingSession(telegramId)
  const { masterId } = session
  if (!masterId) return
  try {
    setBookingSession(telegramId, { step: "date", timeStr: undefined })
    const days = await getNext14DaysForMaster(masterId)
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
  } else if (msg.includes("BOOKING_NOT_RESCHEDULABLE") && session.rescheduleBookingId) {
    text = "Эту запись нельзя перенести (возможно, она уже отменена или изменена). Мои записи: /my_bookings"
    clearBookingSession(ctx.from!.id)
  } else if (
    session.rescheduleBookingId &&
    (msg.includes("SLOT_NOT_AVAILABLE") || msg.includes("Selected slot is no longer available"))
  ) {
    text = "К сожалению, это время только что занял другой клиент. Пожалуйста, выберите другое время."
  } else if (msg.includes("MASTER_NOT_AVAILABLE")) {
    text = "Этот специалист сейчас недоступен. Пожалуйста, выберите другого мастера."
    const telegramId = ctx.from?.id
    if (telegramId !== undefined && session.serviceId) {
      setBookingSession(telegramId, {
        masterId: undefined,
        masterName: undefined,
        dateStr: undefined,
        timeStr: undefined,
        scheduledAtIso: undefined,
        confirm: { ...EMPTY_CONFIRM_STATE },
        step: "master",
      })
      const masters = await getMasters(session.serviceId)
      if (masters.length > 0) {
        const keyboard = new InlineKeyboard()
        for (let i = 0; i < masters.length; i++) {
          keyboard.text(formatMasterDisplayName(masters[i]), `mst:${masters[i].id}`)
          if ((i + 1) % MASTER_BUTTONS_PER_ROW === 0) keyboard.row()
        }
        const full = buildSummary(getBookingSession(telegramId)) + "\n\n" + text
        await editWizardMessage(ctx, getBookingSession(telegramId), full, keyboard)
        return
      }
    }
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

const STALE_MSG = "Экран устарел. Обновляю."

export function isStaleWizardCallback(telegramId: number, expected: WizardStep): boolean {
  const session = getBookingSession(telegramId)
  return session.step !== expected
}

export async function handleStaleCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery({ text: STALE_MSG, show_alert: false }).catch(() => {})
}
