import type { Context } from "grammy"
import { showCategorySelection } from "./catalogFlow.js"

/** Single editable wizard message; no extra reply. */
export async function bookingHandler(ctx: Context): Promise<void> {
  await showCategorySelection(ctx)
}
