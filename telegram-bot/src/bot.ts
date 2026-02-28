import "dotenv/config";
import { Bot } from "grammy"
import { getTelegramUser } from "./api/backend.client.js"
import { stateRouter } from "./router/state.router.js"

const token = process.env.BOT_TOKEN
if (!token) {
  throw new Error("BOT_TOKEN is required")
}

const bot = new Bot(token)

bot.on("message", async (ctx) => {
  const from = ctx.from
  if (!from) return

  const telegramId = String(from.id)
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ") || undefined

  const { userId, state } = await getTelegramUser(telegramId, name)
  await stateRouter(state, ctx, userId)
})

bot.start()
  .then(() => {})
  .catch((err) => {
    throw err
  })
