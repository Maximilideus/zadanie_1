import type { Context } from "grammy"
import type { UserState } from "../types/state.types.js"
import { idleHandler } from "../handlers/idle.handler.js"
import { consultingHandler } from "../handlers/consulting.handler.js"
import { bookingHandler } from "../handlers/booking.handler.js"
import { bookedHandler } from "../handlers/booked.handler.js"

export async function stateRouter(ctx: Context, state: UserState): Promise<void> {
  switch (state) {
    case "IDLE":
      return idleHandler(ctx)
    case "CONSULTING":
      return consultingHandler(ctx)
    case "BOOKING_FLOW":
      return bookingHandler(ctx)
    case "BOOKED":
      return bookedHandler(ctx)
    default: {
      const _exhaust: never = state
      return idleHandler(ctx)
    }
  }
}
