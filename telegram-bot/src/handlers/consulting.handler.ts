import type { Context } from "grammy"

export async function consultingHandler(ctx: Context): Promise<void> {
  await ctx.reply("Режим консультации активирован.")
}
