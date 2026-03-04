import { z } from "zod"

export const bookingIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const updateBookingStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED", "COMPLETED"]),
})

export const telegramIdParamSchema = z.object({
  telegramId: z.string().min(1),
})
