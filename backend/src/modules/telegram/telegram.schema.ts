import { z } from "zod"
import { USER_STATES } from "../user/state.service"

export const telegramAuthSchema = z.object({
  telegramId: z.string().min(1),
  name: z.string().optional(),
})

export const telegramStateSchema = z.object({
  telegramId: z.string().min(1),
  state: z.enum(USER_STATES),
})
