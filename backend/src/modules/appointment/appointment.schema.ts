import { z } from "zod"

export const appointmentIdSchema = z.object({
  id: z.string().uuid(),
})

export const createAppointmentSchema = z.object({
  masterId: z.string().uuid(),
  locationId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  serviceIds: z.array(z.string().uuid()).optional(),
})

export const updateAppointmentSchema = z.object({
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"]).optional(),
})
