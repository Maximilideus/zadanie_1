import "dotenv/config"
import { Bot } from "grammy"
import { telegramAuth, getUserByTelegramId, updateTelegramState, getUpcomingBookings, cancelBookingById } from "./api/backend.client.js"
import { InlineKeyboard } from "grammy"
import { formatServiceDisplayName, formatBookingDate, formatBookingTime, formatMasterDisplayName } from "./services/formatters.js"
import { stateRouter } from "./router/state.router.js"
import { parseCatalogPayload, resolveCatalogDeepLink, formatCatalogIntro } from "./services/deeplink.js"
import {
  onServiceChosen,
  onMasterChosen,
  onDayChosen,
  onManualDateChosen,
  onDateEntered,
  onTimeSlotChosen,
  onConfirmBooking,
  onTimeBack,
  onEditTime,
  onEditDate,
  onEditMaster,
  onChooseAnotherService,
  onCancelFlow,
  getBookingSession,
  clearBookingSession,
  startWizardWithService,
  isDateString,
} from "./handlers/bookingFlow.js"

const UNAVAILABLE = "Сервис временно недоступен. Попробуйте позже."

const token = process.env.BOT_TOKEN
if (!token) {
  throw new Error("BOT_TOKEN is required")
}

const bot = new Bot(token)

bot.catch(async (err) => {
  console.error("[bot.catch]", err.error)
  try {
    if (err.ctx.callbackQuery) {
      await err.ctx.answerCallbackQuery({
        text: "Ошибка. Попробуйте ещё раз.",
        show_alert: false,
      })
    }
  } catch {
    // ignore
  }
})

bot.command("start", async (ctx) => {
  const from = ctx.from
  if (!from) return

  const telegramId = String(from.id)
  const name = from.first_name ?? undefined

  try {
    await telegramAuth(telegramId, name)

    const payload = ctx.match ? String(ctx.match) : undefined
    const catalogItemId = parseCatalogPayload(payload)

    if (catalogItemId) {
      const result = await resolveCatalogDeepLink(catalogItemId)

      if (!result.ok) {
        if (result.reason === "not_bookable") {
          await ctx.reply(
            "Для этой позиции прямая запись недоступна. " +
            "Пожалуйста, воспользуйтесь консультацией или выберите другую услугу.\n\n" +
            "/consult — консультация\n/book — запись"
          )
        } else {
          await ctx.reply(
            "Не удалось открыть запись по выбранной услуге. " +
            "Пожалуйста, начните заново через /consult или /book."
          )
        }
        return
      }

      try {
        await updateTelegramState(telegramId, "BOOKING_FLOW")
      } catch {
        // Best-effort: IDLE->BOOKING_FLOW is not a valid backend transition,
        // so this only succeeds from CONSULTING. The wizard runs via in-memory
        // session regardless; User.state is coarse/secondary.
      }

      const introText = formatCatalogIntro(result.item)
      const service = result.item.service!
      await startWizardWithService(
        ctx,
        result.serviceId,
        formatServiceDisplayName(service),
        service.durationMin,
        introText,
        {
          price: result.item.price ?? undefined,
          catalogTitle: result.item.titleRu,
          category: result.item.category,
        },
      )
      return
    }

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
    if (state === "CONSULTING") {
      try {
        await updateTelegramState(telegramId, "BOOKING_FLOW")
      } catch (e) {
        const err = e as Error & { statusCode?: number }
        if (err.statusCode === 409) {
          await ctx.reply("Сейчас нельзя перейти к записи. Используйте /cancel и попробуйте снова.")
          return
        }
        throw e
      }
    }
    await stateRouter(ctx, "BOOKING_FLOW")
  } catch (e) {
    await ctx.reply(UNAVAILABLE)
  }
})

const STATUS_LABELS: Record<string, string> = {
  PENDING: "ожидает подтверждения",
  CONFIRMED: "подтверждена",
}

function buildBookingListMessage(bookings: Awaited<ReturnType<typeof getUpcomingBookings>>) {
  const lines = ["Ваши ближайшие записи:", ""]
  bookings.forEach((b, i) => {
    const serviceDisplay = formatServiceDisplayName(b.service)
    const masterDisplay = formatMasterDisplayName(b.masterName)
    lines.push(`${i + 1}) ${serviceDisplay}`)
    lines.push(`Мастер: ${masterDisplay}`)
    lines.push(`Дата: ${formatBookingDate(b.scheduledAt)}`)
    lines.push(`Время: ${formatBookingTime(b.scheduledAt)}`)
    lines.push(`Статус: ${STATUS_LABELS[b.status] ?? b.status}`)
    lines.push("")
  })
  const keyboard = new InlineKeyboard()
  bookings.forEach((b, i) => {
    keyboard.text(`❌ Отменить запись ${i + 1}`, `cancel_bk:${b.id}`).row()
  })
  return { text: lines.join("\n").trim(), keyboard }
}

bot.command("my_bookings", async (ctx) => {
  const from = ctx.from
  if (!from) return

  const telegramId = String(from.id)

  try {
    const bookings = await getUpcomingBookings(telegramId)

    if (bookings.length === 0) {
      await ctx.reply("У вас пока нет записей.")
      return
    }

    const { text, keyboard } = buildBookingListMessage(bookings)
    await ctx.reply(text, { reply_markup: keyboard })
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
  } catch (e) {
    const err = e as Error & { statusCode?: number }
    if (err.statusCode === 409) {
      await ctx.reply("Переход в начальное состояние сейчас недоступен. Попробуйте позже.")
      return
    }
    await ctx.reply(UNAVAILABLE)
  }
})

bot.callbackQuery(/^day:(.+)$/, async (ctx) => {
  try {
    await onDayChosen(ctx, ctx.match[1])
    await ctx.answerCallbackQuery().catch(() => {})
  } catch (e) {
    console.error("[wizard] day callback error", e)
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true }).catch(() => {})
  }
})

bot.callbackQuery("manual_date", async (ctx) => {
  try {
    await onManualDateChosen(ctx)
    await ctx.answerCallbackQuery().catch(() => {})
  } catch (e) {
    console.error("[wizard] manual_date callback error", e)
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true }).catch(() => {})
  }
})

bot.callbackQuery(/^svc:(.+)$/, async (ctx) => {
  try {
    await onServiceChosen(ctx, ctx.match[1])
    await ctx.answerCallbackQuery().catch(() => {})
  } catch (e) {
    console.error("[wizard] svc callback error", e)
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true }).catch(() => {})
  }
})

bot.callbackQuery(/^mst:(.+)$/, async (ctx) => {
  try {
    await onMasterChosen(ctx, ctx.match[1])
    await ctx.answerCallbackQuery().catch(() => {})
  } catch (e) {
    console.error("[wizard] mst callback error", e)
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true }).catch(() => {})
  }
})

bot.callbackQuery(/^t:(.+)$/, async (ctx) => {
  try {
    await onTimeSlotChosen(ctx, ctx.match[1])
    await ctx.answerCallbackQuery().catch(() => {})
  } catch (e) {
    console.error("[wizard] time callback error", e)
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true }).catch(() => {})
  }
})

bot.callbackQuery(/^confirm:(.+)$/, async (ctx) => {
  try {
    await onConfirmBooking(ctx, ctx.match[1])
    await ctx.answerCallbackQuery().catch(() => {})
  } catch (e) {
    console.error("[wizard] confirm callback error", e)
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true }).catch(() => {})
  }
})

bot.callbackQuery("time_back", async (ctx) => {
  try {
    await onTimeBack(ctx)
    await ctx.answerCallbackQuery().catch(() => {})
  } catch (e) {
    console.error("[wizard] time_back callback error", e)
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true }).catch(() => {})
  }
})

bot.callbackQuery("edit_time", async (ctx) => {
  try {
    await onEditTime(ctx)
    await ctx.answerCallbackQuery().catch(() => {})
  } catch (e) {
    console.error("[wizard] edit_time callback error", e)
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true }).catch(() => {})
  }
})

bot.callbackQuery("edit_date", async (ctx) => {
  try {
    await onEditDate(ctx)
    await ctx.answerCallbackQuery().catch(() => {})
  } catch (e) {
    console.error("[wizard] edit_date callback error", e)
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true }).catch(() => {})
  }
})

bot.callbackQuery("edit_master", async (ctx) => {
  try {
    await onEditMaster(ctx)
    await ctx.answerCallbackQuery().catch(() => {})
  } catch (e) {
    console.error("[wizard] edit_master callback error", e)
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true }).catch(() => {})
  }
})

bot.callbackQuery("another_service", async (ctx) => {
  try {
    await onChooseAnotherService(ctx)
    await ctx.answerCallbackQuery().catch(() => {})
  } catch (e) {
    console.error("[wizard] another_service callback error", e)
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true }).catch(() => {})
  }
})

bot.callbackQuery("cancel_flow", async (ctx) => {
  try {
    await onCancelFlow(ctx)
    await ctx.answerCallbackQuery().catch(() => {})
  } catch (e) {
    console.error("[wizard] cancel_flow callback error", e)
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true }).catch(() => {})
  }
})

bot.callbackQuery(/^cancel_bk:(.+)$/, async (ctx) => {
  try {
    const bookingId = ctx.match[1]
    const telegramId = String(ctx.from.id)
    const bookings = await getUpcomingBookings(telegramId)
    const booking = bookings.find((b) => b.id === bookingId)
    if (!booking) {
      await ctx.answerCallbackQuery({ text: "Запись не найдена.", show_alert: true })
      return
    }
    const serviceDisplay = formatServiceDisplayName(booking.service)
    const masterDisplay = formatMasterDisplayName(booking.masterName)
    const text =
      "Вы действительно хотите отменить запись?\n\n" +
      `Услуга: ${serviceDisplay}\n` +
      `Мастер: ${masterDisplay}\n` +
      `Дата: ${formatBookingDate(booking.scheduledAt)}\n` +
      `Время: ${formatBookingTime(booking.scheduledAt)}`
    const keyboard = new InlineKeyboard()
      .text("Да, отменить", `cancel_bk_yes:${bookingId}`)
      .text("Назад", "cancel_bk_no")
    await ctx.editMessageText(text, { reply_markup: keyboard })
    await ctx.answerCallbackQuery().catch(() => {})
  } catch (e) {
    console.error("[my_bookings] cancel_bk callback error", e)
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true }).catch(() => {})
  }
})

bot.callbackQuery(/^cancel_bk_yes:(.+)$/, async (ctx) => {
  try {
    const bookingId = ctx.match[1]
    const telegramId = String(ctx.from.id)
    try {
      await cancelBookingById(telegramId, bookingId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("CANCELLATION_TOO_LATE")) {
        await ctx.editMessageText(
          "Отменить запись можно не позднее чем за 4 часа до начала.\n\n" +
          "Используйте /my_bookings для просмотра записей."
        )
        await ctx.answerCallbackQuery().catch(() => {})
        return
      }
      if (msg.includes("BOOKING_NOT_CANCELLABLE") || msg.includes("INVALID_BOOKING_TRANSITION")) {
        await ctx.editMessageText(
          "Эту запись нельзя отменить.\n\n" +
          "Используйте /my_bookings для просмотра записей."
        )
        await ctx.answerCallbackQuery().catch(() => {})
        return
      }
      throw e
    }
    await ctx.editMessageText(
      "✅ Запись отменена.\n\nИспользуйте /my_bookings для просмотра записей."
    )
    await ctx.answerCallbackQuery().catch(() => {})
  } catch (e) {
    console.error("[my_bookings] cancel_bk_yes callback error", e)
    await ctx.editMessageText("Не удалось отменить запись. Попробуйте позже.").catch(() => {})
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true }).catch(() => {})
  }
})

bot.callbackQuery("cancel_bk_no", async (ctx) => {
  try {
    const telegramId = String(ctx.from.id)
    const bookings = await getUpcomingBookings(telegramId)
    if (bookings.length === 0) {
      await ctx.editMessageText("У вас пока нет записей.")
      await ctx.answerCallbackQuery().catch(() => {})
      return
    }
    const { text, keyboard } = buildBookingListMessage(bookings)
    await ctx.editMessageText(text, { reply_markup: keyboard })
    await ctx.answerCallbackQuery().catch(() => {})
  } catch (e) {
    console.error("[my_bookings] cancel_bk_no callback error", e)
    await ctx.answerCallbackQuery({ text: "Ошибка. Попробуйте ещё раз.", show_alert: true }).catch(() => {})
  }
})

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text?.trim() ?? ""
  const from = ctx.from
  if (!from || !text) return
  const session = getBookingSession(from.id)
  if (
    session.awaitingDate &&
    session.serviceId &&
    session.masterId &&
    isDateString(text)
  ) {
    await onDateEntered(ctx, text, session.serviceId, session.masterId)
  }
})

bot.start().catch((err) => {
  throw err
})
