import "dotenv/config"
import { Bot } from "grammy"
import { telegramAuth, getUserByTelegramId, updateTelegramState, getUserBookings, createTelegramBooking } from "./api/backend.client.js"
import { stateRouter } from "./router/state.router.js"
import {
  onServiceChosen,
  onMasterChosen,
  onDateEntered,
  onTimeSlotChosen,
  getBookingSession,
  clearBookingSession,
  isDateString,
} from "./handlers/bookingFlow.js"

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
      "/cancel — отменить действие и вернуться в начало\n" +
      "/my_bookings — мои записи"
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

    try {
      await createTelegramBooking(telegramId)
    } catch (e) {
      if (e instanceof Error && e.message === "ACTIVE_BOOKING_EXISTS") {
        await ctx.reply("У вас уже есть активная запись. Используйте /my_bookings.")
        await updateTelegramState(telegramId, "BOOKING_FLOW")
        await stateRouter(ctx, "BOOKING_FLOW")
        return
      }
      throw e
    }
    await stateRouter(ctx, "BOOKING_FLOW")
  } catch {
    await ctx.reply(UNAVAILABLE)
  }
})

bot.command("my_bookings", async (ctx) => {
  const from = ctx.from
  if (!from) return

  const telegramId = String(from.id)

  try {
    const bookings = await getUserBookings(telegramId)

    if (bookings.length === 0) {
      await ctx.reply("У вас пока нет записей.")
      return
    }

    const lines = ["Ваши записи:"]
    bookings.forEach((b, i) => {
      const created = new Date(b.createdAt).toLocaleDateString("ru-RU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      lines.push("")
      lines.push(`${i + 1}) ID: ${b.id}`)
      lines.push(`   Статус: ${b.status}`)
      lines.push(`   Создано: ${created}`)
    })
    await ctx.reply(lines.join("\n"))
  } catch {
    await ctx.reply(UNAVAILABLE)
  }
})

bot.command("cancel", async (ctx) => {
  const from = ctx.from
  if (!from) return

  const telegramId = String(from.id)
  clearBookingSession(from.id)

  try {
    await updateTelegramState(telegramId, "IDLE")
    await stateRouter(ctx, "IDLE")
    await ctx.reply("Действие отменено. Вы возвращены в начальное состояние.")
  } catch {
    await ctx.reply(UNAVAILABLE)
  }
})

bot.callbackQuery(/^svc:(.+)$/, async (ctx) => {
  await onServiceChosen(ctx, ctx.match[1])
  await ctx.answerCallbackQuery().catch(() => {})
})

bot.callbackQuery(/^mst:(.+)$/, async (ctx) => {
  await onMasterChosen(ctx, ctx.match[1])
  await ctx.answerCallbackQuery().catch(() => {})
})

bot.callbackQuery(/^t:(.+)$/, async (ctx) => {
  await onTimeSlotChosen(ctx, ctx.match[1])
  await ctx.answerCallbackQuery().catch(() => {})
})

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text?.trim() ?? ""
  const from = ctx.from
  if (!from || !text) return
  const session = getBookingSession(from.id)
  if (session.serviceId && session.masterId && isDateString(text)) {
    await onDateEntered(ctx, text, session.serviceId, session.masterId)
  }
})

bot.start().catch((err) => {
  throw err
})
