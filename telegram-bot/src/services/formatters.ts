import { SALON_TIMEZONE } from "../config/salon.js"

export type ServiceLike = { name: string; durationMin?: number }
export type MasterLike = { name: string }

/** Massage subtype: internal name -> Russian (full name for display). */
const MASSAGE_SUBTYPE_RU: Record<string, string> = {
  Lymph: "Лимфодренажный массаж",
  Relax: "Релакс-массаж",
  Sport: "Спортивный массаж",
  Classic: "Классический массаж",
}

/** Service name in Russian WITHOUT duration (show duration on separate line). */
export function formatServiceNameOnly(service: ServiceLike): string {
  const raw = (service.name ?? "").trim()
  if (raw.startsWith("Waxing")) return "Восковая депиляция"
  if (raw.startsWith("Laser")) return "Лазерная эпиляция"
  if (raw.startsWith("Electro")) return "Электроэпиляция"
  if (raw.startsWith("Massage")) {
    const subtype = raw.replace(/^Massage\s+/, "").replace(/\s+\d+\s*min\s*$/i, "").trim()
    return (subtype && MASSAGE_SUBTYPE_RU[subtype]) ? MASSAGE_SUBTYPE_RU[subtype] : (subtype ? `Массаж ${subtype}` : "Массаж")
  }
  const withoutMin = raw.replace(/\s+\d+\s*min\s*$/i, "").trim()
  return withoutMin || raw
}

/**
 * Converts DB service names to Russian display names with duration (for buttons).
 * For confirm/list use formatServiceNameOnly + separate "Длительность" line.
 */
export function formatServiceDisplayName(service: ServiceLike): string {
  const raw = service.name ?? ""
  const durationMin = service.durationMin ?? extractDurationMin(raw)
  const duration = durationMin ? `${durationMin} мин` : "—"
  const nameOnly = formatServiceNameOnly(service)
  if (raw.startsWith("Waxing")) return `Восковая депиляция — ${duration}`
  if (raw.startsWith("Laser")) return `Лазерная эпиляция — ${duration}`
  if (raw.startsWith("Electro")) return `Электроэпиляция — ${duration}`
  if (raw.startsWith("Massage")) return `${nameOnly} — ${duration}`
  return durationMin ? `${raw} — ${duration}` : raw
}

/** Removes trailing " — N мин" from a display string. */
export function stripTrailingDuration(s: string): string {
  return (s ?? "").replace(/\s*—\s*\d+\s*мин\s*$/i, "").trim() || (s ?? "")
}

/**
 * Short labels for inline keyboard buttons (mobile-friendly).
 * Keeps full names for confirmation/summaries.
 *
 * Examples:
 * - "Electro 15 min" -> "Электро — 15 мин"
 * - "Laser 30 min" -> "Лазер — 30 мин"
 * - "Waxing 25 min" -> "Воск — 25 мин"
 * - "Massage Relax 60 min" -> "Массаж Relax — 60 мин"
 */
export function formatServiceButtonLabel(service: ServiceLike): string {
  const raw = service.name ?? ""
  const durationMin = service.durationMin ?? extractDurationMin(raw)
  const duration = durationMin ? `${durationMin} мин` : "—"

  if (raw.startsWith("Electro")) return `Электро — ${duration}`
  if (raw.startsWith("Laser")) return `Лазер — ${duration}`
  if (raw.startsWith("Waxing")) return `Воск — ${duration}`
  if (raw.startsWith("Massage")) return formatServiceDisplayName(service)
  return formatServiceDisplayName(service)
}

export function formatBookingDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("ru-RU", {
    timeZone: SALON_TIMEZONE,
    day: "numeric",
    month: "long",
  })
}

export function formatBookingTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleTimeString("ru-RU", {
    timeZone: SALON_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export function formatBookingSummary(input: {
  serviceDisplayName: string
  masterName: string
  scheduledAt: Date | string
}): { service: string; master: string; date: string; time: string } {
  return {
    service: input.serviceDisplayName,
    master: input.masterName,
    date: formatBookingDate(input.scheduledAt),
    time: formatBookingTime(input.scheduledAt),
  }
}

export type BookingCardInput = {
  service: ServiceLike & { displayName?: string; zone?: string }
  masterName: string
  scheduledAt: Date | string
}

/**
 * Single reusable booking card format. Uses backend displayName when present;
 * otherwise formatServiceNameOnly(service) so no raw internal names like "Electro 15 min".
 */
export function formatBookingCard(booking: BookingCardInput): string {
  const serviceName =
    (booking.service as { displayName?: string }).displayName ??
    formatServiceNameOnly(booking.service)
  const zone = (booking.service as { zone?: string }).zone
  const durationMin = booking.service.durationMin
  const master = formatMasterDisplayName(booking.masterName)
  const date = formatBookingDate(booking.scheduledAt)
  const time = formatBookingTime(booking.scheduledAt)
  return formatBookingCardFromParts({
    serviceName,
    zone,
    durationMin,
    masterName: master,
    date,
    time,
  })
}

/** Same card format from pre-formatted parts (e.g. from session). */
export function formatBookingCardFromParts(parts: {
  serviceName: string
  zone?: string
  durationMin?: number
  masterName: string
  date: string
  time: string
}): string {
  const lines: string[] = [
    `📋 Услуга: ${parts.serviceName}`,
    ...(parts.zone ? [`📍 Зона: ${parts.zone}`] : []),
    ...(parts.durationMin != null ? [`⏱ Длительность: ${parts.durationMin} мин`] : []),
    "",
    `👩‍⚕️ Мастер: ${parts.masterName}`,
    `📅 Дата: ${parts.date}`,
    `⏰ Время: ${parts.time}`,
  ]
  return lines.join("\n")
}

const MASTER_NAME_MAP: Record<string, string> = {
  Anna: "Анна",
  Elena: "Елена",
  Maria: "Мария",
}

export function formatMasterDisplayName(master: MasterLike | string): string {
  const name = typeof master === "string" ? master : master.name
  return MASTER_NAME_MAP[name] ?? name
}

function extractDurationMin(name: string): number | undefined {
  const m = /(\\d+)\\s*min\\s*$/i.exec(name.trim())
  if (!m) return undefined
  const v = Number(m[1])
  return Number.isFinite(v) ? v : undefined
}

