import { FastifyRequest } from "fastify"
import { telegramAuthSchema, telegramStateSchema } from "./telegram.schema"
import { findOrCreateByTelegram, updateStateByTelegramId } from "./telegram.service"

export async function telegramAuthHandler(request: FastifyRequest) {
  const { telegramId, name } = telegramAuthSchema.parse(request.body)
  return findOrCreateByTelegram(telegramId, name)
}

export async function telegramStateHandler(request: FastifyRequest) {
  const { telegramId, state } = telegramStateSchema.parse(request.body)
  return updateStateByTelegramId(telegramId, state)
}
