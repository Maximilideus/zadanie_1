import { FastifyInstance, FastifyRequest } from "fastify"
import { customerHasPhoneByTelegramId } from "../services/CustomerService"

async function checkCustomerPhoneHandler(request: FastifyRequest<{ Querystring: { telegramId?: string } }>) {
  const telegramId = request.query.telegramId
  if (!telegramId || typeof telegramId !== "string") {
    return { hasPhone: false }
  }
  const hasPhone = await customerHasPhoneByTelegramId(telegramId)
  return { hasPhone }
}

export async function telegramCustomersRoutes(app: FastifyInstance) {
  app.get("/customers/check", checkCustomerPhoneHandler)
}
