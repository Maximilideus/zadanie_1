import { z } from "zod"
import { USER_STATES } from "./state.service"

export const changeStateSchema = z.object({
  state: z.enum(USER_STATES),
})

export const userIdParamSchema = z.object({
  id: z.string().uuid(),
})
