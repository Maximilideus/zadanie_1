import type { Context } from "grammy"

export async function idleHandler(ctx: Context): Promise<void> {
  await ctx.reply("Используйте меню ниже или команды: /book — запись, /consult — консультация.")
}
