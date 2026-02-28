import type { Context } from "grammy"

export async function bookingHandler(ctx: Context): Promise<void> {
  await ctx.reply("Процесс записи начат.")
}
