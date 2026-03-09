import type { Context } from "grammy"
import { InlineKeyboard } from "grammy"

const CONSULT_CATEGORY_LABELS: Record<string, string> = {
  laser: "Лазерная депиляция",
  wax: "Восковая депиляция",
  electro: "Электроэпиляция",
  massage: "Массаж",
}

export async function consultingHandler(ctx: Context): Promise<void> {
  await ctx.reply("Консультация. Напишите ваш вопрос — ответим в этом чате.")
}

/**
 * Start consultation flow from website deep link (consult_zones / consult_time).
 * Sends context message, sets CONSULTING state, shows category choices for context.
 * Does NOT enter booking flow.
 */
export async function startConsultationFromDeepLink(
  ctx: Context,
  kind: "zones" | "time",
): Promise<void> {
  const message =
    kind === "zones"
      ? "Вы перешли с сайта. Помогу подобрать подходящие зоны для процедуры."
      : "Вы перешли с сайта. Помогу подобрать удобное время для записи."

  await ctx.reply(message)

  const keyboard = new InlineKeyboard()
  keyboard.text("Лазерная депиляция", "consult_dl:laser").row()
  keyboard.text("Восковая депиляция", "consult_dl:wax").row()
  keyboard.text("Электроэпиляция", "consult_dl:electro").row()
  keyboard.text("Массаж", "consult_dl:massage").row()

  await ctx.reply(
    "Выберите категорию (для консультации). После выбора напишите ваш вопрос или пожелания — ответим в чате.",
    { reply_markup: keyboard },
  )
}

export function getConsultCategoryLabel(slug: string): string {
  return CONSULT_CATEGORY_LABELS[slug] ?? slug
}
