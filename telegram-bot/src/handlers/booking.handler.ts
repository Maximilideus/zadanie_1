import type { Context } from "grammy"
import { showServiceList } from "./bookingFlow.js"

export async function bookingHandler(ctx: Context): Promise<void> {
  await ctx.reply("Процесс записи начат.")
  await showServiceList(ctx)
}
