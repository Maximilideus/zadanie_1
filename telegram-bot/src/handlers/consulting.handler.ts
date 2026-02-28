import type { Context } from "grammy"

export async function consultingHandler(ctx: Context, _userId: string): Promise<void> {
  await ctx.reply("AI consultation mode active.")
}
