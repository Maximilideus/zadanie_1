import { FastifyInstance } from "fastify"
import { telegramAuthHandler, telegramStateHandler } from "./telegram.controller"

export async function telegramRoutes(app: FastifyInstance) {
  app.post("/auth", telegramAuthHandler)
  app.patch("/state", telegramStateHandler)
}
