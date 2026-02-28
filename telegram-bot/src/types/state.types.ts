export type UserState =
  | "IDLE"
  | "CONSULTING"
  | "BOOKING_FLOW"
  | "BOOKED"

export interface TelegramAuthResponse {
  userId: string
  state: UserState
}
