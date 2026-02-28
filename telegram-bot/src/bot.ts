import "dotenv/config"
import { Bot } from "grammy"
import { telegramAuth, getUserByTelegramId, updateTelegramState } from "./api/backend.client.js"
import { stateRouter } from "./router/state.router.js"

const UNAVAILABLE = "Сервис временно недоступен. Попробуйте позже."

const token = process.env.BOT_TOKEN
if (!token) {
  throw new Error("BOT_TOKEN is required")
}

const bot = new Bot(token)

bot.command("start", async (ctx) => {
  const from = ctx.from
  if (!from) return

  const telegramId = String(from.id)
  const name = from.first_name ?? undefined

  try {
    const { state } = await telegramAuth(telegramId, name)
    await stateRouter(ctx, state)
  } catch {
    await ctx.reply(UNAVAILABLE)
  }
})

bot.command("help", async (ctx) => {
  await ctx.reply(
    "Доступные команды:\n\n" +
      "/start — инициализация сессии\n" +
      "/help — показать это сообщение\n" +
      "/status — показать текущий статус\n" +
      "/consult — начать консультацию\n" +
      "/book — перейти к записи\n" +
      "/cancel — отменить действие и вернуться в начало"
  )
})

bot.command("status", async (ctx) => {
  const from = ctx.from
  if (!from) return

  const telegramId = String(from.id)

  try {
    const { state } = await getUserByTelegramId(telegramId)
    await ctx.reply(`Ваш текущий статус: ${state}`)
  } catch {
    await ctx.reply(UNAVAILABLE)
  }
})

bot.command("consult", async (ctx) => {
  const from = ctx.from
  if (!from) return

  const telegramId = String(from.id)

  try {
    const { state } = await telegramAuth(telegramId)

    if (state !== "IDLE") {
      await ctx.reply("Сейчас нельзя начать консультацию.")
      return
    }

    await updateTelegramState(telegramId, "CONSULTING")
    await stateRouter(ctx, "CONSULTING")
  } catch {
    await ctx.reply(UNAVAILABLE)
  }
})

bot.command("book", async (ctx) => {
  const from = ctx.from
  if (!from) return

  const telegramId = String(from.id)

  try {
    const { state } = await telegramAuth(telegramId)

    if (state !== "CONSULTING") {
      await ctx.reply("Сначала необходимо завершить консультацию.")
      return
    }

    await updateTelegramState(telegramId, "BOOKING_FLOW")
    await stateRouter(ctx, "BOOKING_FLOW")
  } catch {
    await ctx.reply(UNAVAILABLE)
  }
})

bot.command("cancel", async (ctx) => {
  const from = ctx.from
  if (!from) return

  const telegramId = String(from.id)

  try {
    await updateTelegramState(telegramId, "IDLE")
    await stateRouter(ctx, "IDLE")
    await ctx.reply("Действие отменено. Вы возвращены в начальное состояние.")
  } catch {
    await ctx.reply(UNAVAILABLE)
  }
})

bot.start().catch((err) => {
  throw err
})
