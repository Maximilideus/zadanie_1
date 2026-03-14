import { createBooking } from "../booking/booking.service"
import { prisma } from "../../lib/prisma"
import type { TelegramState } from "./telegram.schema"
import { getOrCreateTelegramSession, setTelegramState } from "./telegram-session.service"

/** Find user by telegramId only if present (legacy; used for BOOKED transition if ever sent). */
async function findUserByTelegramId(telegramId: string) {
  return prisma.user.findUnique({
    where: { telegramId },
    select: { id: true },
  })
}

/** POST /telegram/auth: state from TelegramSession only; no User required (Phase 5). */
export async function findOrCreateByTelegram(telegramId: string, _name?: string) {
  const session = await getOrCreateTelegramSession(telegramId)
  return { userId: null, state: session.state }
}

/**
 * PATCH /telegram/state: telegram-safe state transition.
 * Reads/writes TelegramSession only. BOOKED branch: legacy only (creates booking via User if present); bot does not send BOOKED.
 */
export async function updateStateByTelegramId(
  telegramId: string,
  newState: TelegramState
): Promise<{ ok: true; state: string }> {
  if (newState === "BOOKED") {
    const user = await findUserByTelegramId(telegramId)
    if (user) await createBooking(user.id)
  }
  const result = await setTelegramState(telegramId, newState)
  return { ok: true, state: result.newState }
}
