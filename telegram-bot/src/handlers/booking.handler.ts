import type { Context } from "grammy"

export async function bookingHandler(ctx: Context, _userId: string): Promise<void> {
  await ctx.reply("Booking flow started.")
}
