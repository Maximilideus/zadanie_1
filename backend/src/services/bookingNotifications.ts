import { sendTelegramMessage } from "./telegramSender"
import { SALON_TIMEZONE } from "../config/salon"

interface BookingNotificationData {
  telegramId: string | null
  newStatus: string
  serviceName: string | null
  masterName: string | null
  scheduledAt: Date | null
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: SALON_TIMEZONE,
  })
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SALON_TIMEZONE,
  })
}

function buildDetailsBlock(data: BookingNotificationData): string {
  const lines: string[] = []
  if (data.serviceName) lines.push(`📋 Услуга: ${data.serviceName}`)
  if (data.masterName) lines.push(`👤 Мастер: ${data.masterName}`)
  if (data.scheduledAt) {
    lines.push(`📅 Дата: ${formatDate(data.scheduledAt)}`)
    lines.push(`⏰ Время: ${formatTime(data.scheduledAt)}`)
  }
  return lines.join("\n")
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
