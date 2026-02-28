import { prisma } from "../../lib/prisma"

export const USER_STATES = ["IDLE", "CONSULTING", "BOOKING_FLOW", "BOOKED"] as const
export type UserState = (typeof USER_STATES)[number]

const ALLOWED_TRANSITIONS: Record<UserState, UserState[]> = {
  IDLE: ["CONSULTING"],
  CONSULTING: ["BOOKING_FLOW", "IDLE"],
  BOOKING_FLOW: ["BOOKED"],
  BOOKED: ["IDLE", "CONSULTING"],
}

export function isValidUserState(value: string): value is UserState {
  return USER_STATES.includes(value as UserState)
}

export async function getUserState(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, state: true },
  })

  if (!user) throw new Error("NOT_FOUND")

  return { userId: user.id, state: user.state as UserState }
}

export async function changeUserState(userId: string, newState: UserState) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, state: true },
  })

  if (!user) throw new Error("NOT_FOUND")

  const currentState = user.state as UserState
  if (newState === "IDLE") {
    await prisma.user.update({
      where: { id: userId },
      data: { state: newState },
    })
    return { userId: user.id, oldState: currentState, newState }
  }
  const allowed = ALLOWED_TRANSITIONS[currentState]
  if (!allowed.includes(newState)) {
    throw new Error("INVALID_TRANSITION")
  }

  if (newState === "BOOKED") {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { state: newState },
      })
      await tx.booking.create({
        data: {
          userId: user.id,
          status: "PENDING",
        },
      })
    })
    return { userId: user.id, oldState: currentState, newState }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { state: newState },
  })

  return {
    userId: user.id,
    oldState: currentState,
    newState,
  }
}
