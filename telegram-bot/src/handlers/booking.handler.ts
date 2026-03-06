import type { Context } from "grammy"
import { startWizard } from "./bookingFlow.js"

/** Single editable wizard message; no extra reply. */
export async function bookingHandler(ctx: Context): Promise<void> {
  await startWizard(ctx)
}
