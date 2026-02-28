import { FastifyInstance } from "fastify"
import { telegramAuthHandler } from "./telegram.controller"

export async function telegramRoutes(app: FastifyInstance) {
  app.post("/auth", telegramAuthHandler)
}
