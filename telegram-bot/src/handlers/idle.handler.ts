import type { Context } from "grammy"

export async function idleHandler(ctx: Context, _userId: string): Promise<void> {
  await ctx.reply("Welcome. Type 'start' to begin consultation.")
}
