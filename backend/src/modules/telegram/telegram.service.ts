import crypto from "node:crypto"
import { prisma } from "../../lib/prisma"
import { hashPassword } from "../auth/auth.service"
import { changeUserState, type UserState } from "../user/state.service"

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

export async function updateStateByTelegramId(telegramId: string, newState: UserState) {
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true },
  })

  if (!user) throw new Error("NOT_FOUND")

  return changeUserState(user.id, newState)
}
