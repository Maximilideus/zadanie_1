import { sendTelegramMessage } from "./telegramSender"
import { formatBookingCardFromParts } from "./bookingCard"
import { SALON_TIMEZONE } from "../config/salon"

interface BookingNotificationData {
  telegramId: string | null
  newStatus: string
  serviceName: string | null
  masterName: string | null
  scheduledAt: Date | null
  durationMin?: number | null
  zone?: string | null
  isElectroTimePackage?: boolean
}

function buildDetailsBlock(data: BookingNotificationData): string {
  const d = data.scheduledAt
  const date = d
    ? d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: SALON_TIMEZONE })
    : "—"
  const time = d
    ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: SALON_TIMEZONE })
    : "—"
  const serviceName =
    data.isElectroTimePackage && !data.zone
      ? "Электроэпиляция"
      : (data.serviceName ?? "—")
  return formatBookingCardFromParts({
    serviceName,
    zone: data.zone ?? undefined,
    durationMin: data.durationMin ?? undefined,
    isElectroTimePackage: data.isElectroTimePackage,
    masterName: data.masterName ?? "—",
    date,
    time,
  })
}

function buildMessage(data: BookingNotificationData): string | null {
  const details = buildDetailsBlock(data)

  switch (data.newStatus) {
    case "CONFIRMED":
      return (
        "✅ Ваша запись подтверждена!\n\n" +
        "Ждём вас в назначенное время.\n\n" +
        details +
        "\n\nЕсли у вас изменятся планы — пожалуйста сообщите нам заранее."
      )

    case "CANCELLED":
      return (
        "❌ К сожалению, запись не была подтверждена администратором.\n\n" +
        details +
        "\n\nВы можете выбрать другое время и оформить новую запись."
      )

    case "COMPLETED":
      return (
        "✨ Спасибо за визит!\n\n" +
        "Ваша запись отмечена как завершённая.\n\n" +
        "Будем рады видеть вас снова."
      )

    default:
      return null
  }
}

export async function sendBookingStatusNotification(
  data: BookingNotificationData
): Promise<void> {
  if (!data.telegramId) return

  const text = buildMessage(data)
  if (!text) return

  const ok = await sendTelegramMessage({ chat_id: data.telegramId, text })
  if (ok) {
    console.log(`[booking-notify] Sent ${data.newStatus} notification to TG:${data.telegramId}`)
  } else {
    console.warn(`[booking-notify] Failed to send ${data.newStatus} notification to TG:${data.telegramId}`)
  }
}
