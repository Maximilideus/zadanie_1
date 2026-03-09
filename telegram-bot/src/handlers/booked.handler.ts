import type { Context } from "grammy"

export async function bookedHandler(ctx: Context): Promise<void> {
  await ctx.reply("У вас есть активная запись. Посмотреть: /my_bookings")
}
