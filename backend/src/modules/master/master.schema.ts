import { z } from "zod"

export const createMasterSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  locationId: z.string().uuid().optional(),
})

export const updateMasterSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  locationId: z.string().uuid().nullable().optional(),
})

export const masterIdSchema = z.object({
  id: z.string().uuid(),
})
