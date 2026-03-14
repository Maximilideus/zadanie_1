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

/** Category (ELECTRO/LASER/WAX/MASSAGE) → procedure type for "Услуга" line. */
const CATEGORY_TO_PROCEDURE: Record<string, string> = {
  ELECTRO: "Электроэпиляция",
  LASER: "Лазерная эпиляция",
  WAX: "Восковая депиляция",
  MASSAGE: "Массаж",
}

/** Normalize category for display logic (e.g. laser -> LASER). ELECTRO is time-only, never show zone. */
export function normalizeCategory(category?: string): string | undefined {
  if (category == null || category === "") return undefined
  const u = category.trim().toUpperCase()
  return u in CATEGORY_TO_PROCEDURE ? u : undefined
}

/**
 * Procedure type for session-based card. Prefers category so zone is never shown as "Услуга".
 * For MASSAGE, uses stripped serviceName to preserve subtype (e.g. Релакс-массаж).
 * Category is normalized before lookup (laser -> LASER).
 */
export function getProcedureTypeForSession(category?: string, serviceName?: string): string {
  const cat = normalizeCategory(category)
  if (cat === "MASSAGE" && serviceName) {
    return stripTrailingDuration(serviceName) || CATEGORY_TO_PROCEDURE.MASSAGE
  }
  if (cat && CATEGORY_TO_PROCEDURE[cat]) return CATEGORY_TO_PROCEDURE[cat]
  return stripTrailingDuration(serviceName ?? "—") || "—"
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
  service: ServiceLike & {
    displayName?: string
    zone?: string
    isElectroTimePackage?: boolean
    /** When present, "Услуга" line uses category-based mapping instead of service.name. */
    category?: string
  }
  masterName: string
  scheduledAt: Date | string
}

/** Parts for the unified booking block. procedureType = type of procedure (e.g. Электроэпиляция); zone = body zone when applicable. */
export type BookingBlockParts = {
  procedureType: string
  zone?: string
  durationMin?: number
  masterName: string
  date: string
  time: string
  /** ELECTRO is time-only: never render a zone line (business rule). */
  suppressZone?: boolean
  price?: number
  status?: string
}

/**
 * Single unified booking block format. Used everywhere: wizard summary, confirmation,
 * success, reschedule, cancel, booking list, nearest slot.
 * Order: date, time, blank, service (procedure type), zone (if any, never for ELECTRO), duration (if any), master, optional price/status.
 * ELECTRO: service + duration only; zone line is never shown.
 */
export function formatBookingBlock(parts: BookingBlockParts): string {
  const lines: string[] = []
  lines.push(`📅 ${parts.date}`)
  lines.push(`⏰ ${parts.time}`)
  lines.push("")
  lines.push(`📋 Услуга: ${parts.procedureType}`)
  if (!parts.suppressZone && parts.zone) lines.push(`📍 Зона: ${parts.zone}`)
  if (parts.durationMin != null) lines.push(`⏱ Длительность: ${parts.durationMin} мин`)
  lines.push("")
  lines.push(`👩‍⚕️ Мастер: ${parts.masterName}`)
  if (parts.price != null) lines.push(`💳 Цена: ${parts.price.toLocaleString("ru-RU")} ₽`)
  if (parts.status != null) lines.push(`Статус: ${parts.status}`)
  return lines.join("\n")
}

/**
 * Service type label for "Услуга" line from category (and optional service name for MASSAGE).
 * Use this when category is available; do not derive from service.name/zone labels.
 */
export function mapCategoryToServiceType(category?: string, serviceName?: string): string {
  return getProcedureTypeForSession(category, serviceName)
}

/**
 * Booking card: "Услуга" line from category when present, else fallback from service.name.
 * Zone from service.zone; ELECTRO and MASSAGE never show zone line.
 */
export function formatBookingCard(booking: BookingCardInput): string {
  const cat = normalizeCategory(booking.service.category)
  const procedureType =
    cat === "MASSAGE"
      ? formatServiceNameOnly(booking.service)
      : cat != null
        ? mapCategoryToServiceType(booking.service.category ?? undefined, booking.service.name)
        : formatServiceNameOnly(booking.service)
  const isElectro =
    cat === "ELECTRO" ||
    booking.service.isElectroTimePackage === true ||
    (booking.service.name ?? "").trim().toLowerCase().startsWith("electro")
  const suppressZone = isElectro || cat === "MASSAGE"
  const zone = suppressZone ? undefined : (booking.service as { zone?: string }).zone
  const durationMin = booking.service.durationMin
  const master = formatMasterDisplayName(booking.masterName)
  const date = formatBookingDate(booking.scheduledAt)
  const time = formatBookingTime(booking.scheduledAt)
  return formatBookingBlock({
    procedureType,
    zone,
    durationMin,
    suppressZone,
    masterName: master,
    date,
    time,
  })
}

/** Same block from pre-formatted parts (e.g. from session). serviceName here is the procedure type. */
export function formatBookingCardFromParts(parts: {
  serviceName: string
  zone?: string
  durationMin?: number
  masterName: string
  date: string
  time: string
  suppressZone?: boolean
}): string {
  return formatBookingBlock({
    procedureType: parts.serviceName,
    zone: parts.zone,
    durationMin: parts.durationMin,
    masterName: parts.masterName,
    date: parts.date,
    time: parts.time,
    suppressZone: parts.suppressZone,
  })
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
  const m = /(\d+)\s*min\s*$/i.exec(name.trim())
  if (!m) return undefined
  const v = Number(m[1])
  return Number.isFinite(v) ? v : undefined
}

