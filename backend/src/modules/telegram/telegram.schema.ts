import { z } from "zod"

export const telegramAuthSchema = z.object({
  telegramId: z.string().min(1),
  name: z.string().optional(),
})
