import { z } from "zod"

export const TELEGRAM_STATE_VALUES = ["IDLE", "CONSULTING", "BOOKING_FLOW"] as const
export type TelegramState = (typeof TELEGRAM_STATE_VALUES)[number]

export const telegramAuthSchema = z.object({
  telegramId: z.string().min(1),
  name: z.string().optional(),
})

export const telegramStateSchema = z.object({
  telegramId: z.string().min(1),
  state: z.enum(TELEGRAM_STATE_VALUES),
})
