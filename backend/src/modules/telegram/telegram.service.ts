import crypto from "node:crypto"
import { prisma } from "../../lib/prisma"
import { hashPassword } from "../auth/auth.service"
import { changeUserState, type UserState } from "../user/state.service"
import type { TelegramState } from "./telegram.schema"

export async function findOrCreateByTelegram(telegramId: string, name?: string) {
  const existing = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true, state: true },
  })

  if (existing) {
    return { userId: existing.id, state: existing.state }
  }

  const email = `telegram_${telegramId}@local.dev`
  const password = crypto.randomUUID()
  const hashedPassword = await hashPassword(password)

  const newUser = await prisma.user.create({
    data: {
      name: name?.trim() || "Telegram User",
      email,
      password: hashedPassword,
      role: "CLIENT",
      state: "IDLE",
      telegramId,
    },
    select: { id: true, state: true },
  })

  return { userId: newUser.id, state: newUser.state }
}

/** Find user by telegramId; if missing (e.g. fresh DB), create with default CLIENT/IDLE. */
async function findOrCreateUserByTelegramId(telegramId: string) {
  const existing = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true, state: true },
  })
  if (existing) return existing

  const email = `telegram_${telegramId}@local.dev`
  const password = crypto.randomUUID()
  const hashedPassword = await hashPassword(password)

  const newUser = await prisma.user.create({
    data: {
      name: "Telegram User",
      email,
      password: hashedPassword,
      role: "CLIENT",
      state: "IDLE",
      telegramId,
    },
    select: { id: true, state: true },
  })
  return newUser
}

/**
 * PATCH /telegram/state: telegram-safe state transition.
 * Creates user if not found, then applies UserStateMachine rules.
 */
export async function updateStateByTelegramId(
  telegramId: string,
  newState: TelegramState
): Promise<{ ok: true; state: string }> {
  const user = await findOrCreateUserByTelegramId(telegramId)
  const result = await changeUserState(user.id, newState as UserState)
  return { ok: true, state: result.newState }
}
