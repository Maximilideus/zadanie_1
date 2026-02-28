import type { Context } from "grammy"

export async function idleHandler(ctx: Context): Promise<void> {
  await ctx.reply("Вы находитесь в начальном состоянии. Используйте /consult для начала.")
}
