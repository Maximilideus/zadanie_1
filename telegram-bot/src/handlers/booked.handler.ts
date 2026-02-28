import type { Context } from "grammy"

export async function bookedHandler(ctx: Context, _userId: string): Promise<void> {
  await ctx.reply("You are already booked.")
}
