import { FastifyRequest } from "fastify"
import { changeStateSchema, userIdParamSchema } from "./state.schema"
import { changeUserState } from "./state.service"

export async function changeStateHandler(request: FastifyRequest) {
  const { id } = userIdParamSchema.parse(request.params)
  const { state } = changeStateSchema.parse(request.body)

  return changeUserState(id, state)
}
