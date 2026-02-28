import type { Context } from "grammy"

export async function bookedHandler(ctx: Context): Promise<void> {
  await ctx.reply("Вы уже записаны.")
}
