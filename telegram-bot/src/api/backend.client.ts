import type { TelegramAuthResponse } from "../types/state.types.js"

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000"

export interface UpdateStateResponse {
  userId: string
  oldState: string
  newState: string
}

export async function telegramAuth(
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

  return (await res.json()) as TelegramAuthResponse
}

export async function getUserByTelegramId(
  telegramId: string
): Promise<TelegramAuthResponse> {
  return telegramAuth(telegramId)
}

export async function updateTelegramState(
  telegramId: string,
  newState: string
): Promise<UpdateStateResponse> {
  const res = await fetch(`${BACKEND_URL}/telegram/state`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegramId, state: newState }),
  })

  if (!res.ok) {
    throw new Error(`Backend error: ${res.status}`)
  }

  return (await res.json()) as UpdateStateResponse
}
