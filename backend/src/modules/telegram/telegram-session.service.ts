import { prisma } from "../../lib/prisma"
import type { TelegramState } from "./telegram.schema"

/** Same state values as User.state for Telegram flows (including BOOKED for /status). */
const SESSION_STATES = ["IDLE", "CONSULTING", "BOOKING_FLOW", "BOOKED"] as const
type SessionState = (typeof SESSION_STATES)[number]

const ALLOWED_TRANSITIONS: Record<SessionState, SessionState[]> = {
  IDLE: ["CONSULTING"],
  CONSULTING: ["BOOKING_FLOW", "IDLE"],
  BOOKING_FLOW: ["BOOKED", "IDLE"],
  BOOKED: ["IDLE", "CONSULTING"],
}

function isValidSessionState(value: string): value is SessionState {
  return SESSION_STATES.includes(value as SessionState)
}

/**
 * Get or create TelegramSession for telegramId.
 * On create: if User exists with this telegramId, seed state from User.state; else IDLE.
 */
export async function getOrCreateTelegramSession(telegramId: string) {
  let session = await prisma.telegramSession.findUnique({
    where: { telegramId },
  })

  if (session) return session

  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { state: true },
  })

  const initialState = user?.state && isValidSessionState(user.state) ? user.state : "IDLE"

  session = await prisma.telegramSession.create({
    data: { telegramId, state: initialState },
  })

  return session
}

/** Get current state from TelegramSession (creates session if missing). */
export async function getTelegramState(telegramId: string): Promise<string> {
  const session = await getOrCreateTelegramSession(telegramId)
  return session.state
}

/**
 * Update TelegramSession state with same transition rules as User state machine.
 * Does NOT create booking; caller must create booking when transitioning to BOOKED.
 */
export async function setTelegramState(
  telegramId: string,
  newState: TelegramState | SessionState
): Promise<{ oldState: string; newState: string }> {
  const session = await getOrCreateTelegramSession(telegramId)
  const currentState = session.state as SessionState

  if (!isValidSessionState(newState)) {
    throw new Error("INVALID_STATE")
  }

  if (newState === "IDLE") {
    await prisma.telegramSession.update({
      where: { telegramId },
      data: { state: newState },
    })
    return { oldState: currentState, newState }
  }

  const allowed = ALLOWED_TRANSITIONS[currentState]
  if (!allowed.includes(newState as SessionState)) {
    throw new Error("INVALID_TRANSITION")
  }

  await prisma.telegramSession.update({
    where: { telegramId },
    data: { state: newState },
  })

  return { oldState: currentState, newState }
}
