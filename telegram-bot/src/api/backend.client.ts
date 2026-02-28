import type { TelegramAuthResponse } from "../types/state.types.js"

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000"

export async function getTelegramUser(
  telegramId: string,
  name?: string
): Promise<TelegramAuthResponse> {
  const res = await fetch(`${BACKEND_URL}/telegram/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegramId, name }),
  })

  if (!res.ok) {
    throw new Error(`Backend error: ${res.status}`)
  }

  const data = (await res.json()) as TelegramAuthResponse
  return data
}
