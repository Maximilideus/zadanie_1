import { env } from "../config/env"

const API_BASE = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`

export interface InlineButton {
  text: string
  callback_data: string
}

interface SendMessageParams {
  chat_id: string | number
  text: string
  reply_markup?: { inline_keyboard: InlineButton[][] }
}

export async function sendTelegramMessage(params: SendMessageParams): Promise<boolean> {
  if (!env.TELEGRAM_BOT_TOKEN) return false
  try {
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: params.chat_id,
        text: params.text,
        parse_mode: "HTML",
        ...(params.reply_markup ? { reply_markup: params.reply_markup } : {}),
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error("[telegram-sender] sendMessage failed", res.status, body)
      return false
    }
    return true
  } catch (e) {
    console.error("[telegram-sender] sendMessage error", e)
    return false
  }
}
