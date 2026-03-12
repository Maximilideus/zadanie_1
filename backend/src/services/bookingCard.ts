import { SALON_TIMEZONE } from "../config/salon"

function formatDate(d: Date): string {
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: SALON_TIMEZONE,
  })
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: SALON_TIMEZONE,
  })
}

export interface BookingCardParts {
  serviceName: string
  zone?: string
  durationMin?: number
  masterName: string
  date: string
  time: string
  /** ELECTRO time-based service: use "Пакет времени" instead of "Зона" */
  isElectroTimePackage?: boolean
}

/**
 * Same card format as telegram-bot formatBookingCardFromParts.
 * Use for reminders and status notifications so all booking messages look the same.
 */
export function formatBookingCardFromParts(parts: BookingCardParts): string {
  const serviceLines: string[] = []
  if (parts.isElectroTimePackage && parts.zone) {
    serviceLines.push(`🗂 Пакет времени: ${parts.zone}`)
  } else {
    serviceLines.push(`📋 Услуга: ${parts.serviceName}`)
    if (parts.zone) serviceLines.push(`📍 Зона: ${parts.zone}`)
  }
  if (parts.durationMin != null) serviceLines.push(`⏱ Длительность: ${parts.durationMin} мин`)
  const lines: string[] = [
    ...serviceLines,
    "",
    `👩‍⚕️ Мастер: ${parts.masterName}`,
    `📅 Дата: ${parts.date}`,
    `⏰ Время: ${parts.time}`,
  ]
  return lines.join("\n")
}

export function formatBookingCardFromBooking(
  serviceName: string,
  masterName: string,
  scheduledAt: Date,
  options?: { zone?: string; durationMin?: number; isElectroTimePackage?: boolean }
): string {
  return formatBookingCardFromParts({
    serviceName,
    zone: options?.zone,
    durationMin: options?.durationMin,
    isElectroTimePackage: options?.isElectroTimePackage,
    masterName,
    date: formatDate(scheduledAt),
    time: formatTime(scheduledAt),
  })
}
