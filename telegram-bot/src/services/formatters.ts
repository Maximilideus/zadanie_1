const SALON_TIMEZONE = "Europe/Berlin"

export type ServiceLike = { name: string; durationMin?: number }
export type MasterLike = { name: string }

/**
 * Converts DB service names (English) to Russian display names without changing DB values.
 * Examples:
 * - "Waxing 15 min" -> "Восковая депиляция — 15 мин"
 * - "Laser 30 min"  -> "Лазерная эпиляция — 30 мин"
 * - "Electro 60 min" -> "Электроэпиляция — 60 мин"
 * - "Massage Relax 60 min" -> "Массаж Relax — 60 мин"
 */
export function formatServiceDisplayName(service: ServiceLike): string {
  const raw = service.name ?? ""
  const durationMin = service.durationMin ?? extractDurationMin(raw)
  const duration = durationMin ? `${durationMin} мин` : "—"

  if (raw.startsWith("Waxing")) return `Восковая депиляция — ${duration}`
  if (raw.startsWith("Laser")) return `Лазерная эпиляция — ${duration}`
  if (raw.startsWith("Electro")) return `Электроэпиляция — ${duration}`
  if (raw.startsWith("Massage")) {
    const subtype = raw
      .replace(/^Massage\\s+/, "")
      .replace(/\\s+\\d+\\s+min\\s*$/, "")
      .trim()
    return subtype.length > 0 ? `Массаж ${subtype} — ${duration}` : `Массаж — ${duration}`
  }
  return durationMin ? `${raw} — ${duration}` : raw
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

