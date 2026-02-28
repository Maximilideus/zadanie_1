import { FastifyRequest } from "fastify"
import { telegramAuthSchema } from "./telegram.schema"
import { findOrCreateByTelegram } from "./telegram.service"

export async function telegramAuthHandler(request: FastifyRequest) {
  const { telegramId, name } = telegramAuthSchema.parse(request.body)

  const result = await findOrCreateByTelegram(telegramId, name)

  return result
}
