import type { Context } from "grammy"
import type { UserState } from "../types/state.types.js"
import { idleHandler } from "../handlers/idle.handler.js"
import { consultingHandler } from "../handlers/consulting.handler.js"
import { bookingHandler } from "../handlers/booking.handler.js"
import { bookedHandler } from "../handlers/booked.handler.js"

export async function stateRouter(
  state: UserState,
  ctx: Context,
  userId: string
): Promise<void> {
  switch (state) {
    case "IDLE":
      return idleHandler(ctx, userId)
    case "CONSULTING":
      return consultingHandler(ctx, userId)
    case "BOOKING_FLOW":
      return bookingHandler(ctx, userId)
    case "BOOKED":
      return bookedHandler(ctx, userId)
    default: {
      const _exhaust: never = state
      return idleHandler(ctx, userId)
    }
  }
}
