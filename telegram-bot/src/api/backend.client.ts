import type { TelegramAuthResponse } from "../types/state.types.js"

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000"

export interface UpdateStateResponse {
  userId: string
  oldState: string
  newState: string
}

export async function telegramAuth(
  telegramId: string,
  name?: string
): Promise<TelegramAuthResponse> {
  const res = await fetch(`${BACKEND_URL}/telegram/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegramId, name }),
  })

  if (!res.ok) {
    throw new Error(`Backend error: ${res.status}`)
  }

  return (await res.json()) as TelegramAuthResponse
}

export async function getUserByTelegramId(
  telegramId: string
): Promise<TelegramAuthResponse> {
  return telegramAuth(telegramId)
}

export interface PatchStateResponse {
  ok: true
  state: string
}

export async function updateTelegramState(
  telegramId: string,
  newState: string
): Promise<PatchStateResponse> {
  const res = await fetch(`${BACKEND_URL}/telegram/state`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegramId, state: newState }),
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    const msg = body.message ?? `Backend error: ${res.status}`
    const err = new Error(msg) as Error & { statusCode?: number }
    err.statusCode = res.status
    throw err
  }

  return (await res.json()) as PatchStateResponse
}

export interface UserBookingItem {
  id: string
  status: string
  createdAt: string
  scheduledAt: string | null
}

export async function getUserBookings(
  telegramId: string
): Promise<UserBookingItem[]> {
  const res = await fetch(`${BACKEND_URL}/bookings/user/${encodeURIComponent(telegramId)}`)

  if (!res.ok) {
    throw new Error(`Backend error: ${res.status}`)
  }

  return (await res.json()) as UserBookingItem[]
}

export interface UpcomingBookingItem {
  id: string
  status: string
  scheduledAt: string
  service: { name: string; durationMin?: number }
  masterName: string
}

export async function getUpcomingBookings(
  telegramId: string
): Promise<UpcomingBookingItem[]> {
  const res = await fetch(
    `${BACKEND_URL}/bookings/user/${encodeURIComponent(telegramId)}/upcoming`
  )
  if (!res.ok) {
    throw new Error(`Backend error: ${res.status}`)
  }
  return (await res.json()) as UpcomingBookingItem[]
}

export interface CreateTelegramBookingResponse {
  id: string
  userId: string
  status: string
  createdAt: string
  updatedAt: string
  scheduledAt: string | null
  confirmedAt: string | null
  cancelledAt: string | null
  completedAt: string | null
}

export async function createTelegramBooking(
  telegramId: string
): Promise<CreateTelegramBookingResponse> {
  const res = await fetch(`${BACKEND_URL}/telegram/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegramId }),
  })

  if (!res.ok) {
    const text = await res.text()
    if (res.status === 409) throw new Error("ACTIVE_BOOKING_EXISTS")
    throw new Error(`Backend error: ${res.status} ${text}`)
  }

  return (await res.json()) as CreateTelegramBookingResponse
}

/** Ensure user has an active PENDING booking. Idempotent. Does not change state (backend sets BOOKING_FLOW on create). */
export async function ensureActiveBooking(telegramId: string): Promise<void> {
  try {
    await createTelegramBooking(telegramId)
  } catch (e) {
    if (e instanceof Error && e.message === "ACTIVE_BOOKING_EXISTS") {
      return
    }
    throw e
  }
}

async function parseError(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({})) as { message?: string }
  const msg = body.message ?? `Backend error: ${res.status}`
  throw new Error(msg)
}

export interface ServiceItem {
  id: string
  name: string
  durationMin: number
  price: number
  locationId: string
}

export async function getServices(locationId?: string): Promise<ServiceItem[]> {
  const url = new URL(`${BACKEND_URL}/telegram/services`)
  if (locationId) url.searchParams.set("locationId", locationId)
  const res = await fetch(url.toString())
  if (!res.ok) return parseError(res)
  const data = (await res.json()) as { services: ServiceItem[] }
  return data.services
}

export interface MasterItem {
  id: string
  name: string
}

export async function getMasters(serviceId?: string): Promise<MasterItem[]> {
  const url = new URL(`${BACKEND_URL}/telegram/masters`)
  if (serviceId) url.searchParams.set("serviceId", serviceId)
  const res = await fetch(url.toString())
  if (!res.ok) return parseError(res)
  const data = (await res.json()) as { masters: MasterItem[] }
  return data.masters
}

export interface AvailabilityResponse {
  timezone: string
  slots: string[]
}

export async function getAvailability(
  serviceId: string,
  masterId: string,
  date: string
): Promise<AvailabilityResponse> {
  const url = new URL(`${BACKEND_URL}/telegram/availability`)
  url.searchParams.set("serviceId", serviceId)
  url.searchParams.set("masterId", masterId)
  url.searchParams.set("date", date)
  const res = await fetch(url.toString())
  if (!res.ok) return parseError(res)
  return (await res.json()) as AvailabilityResponse
}

export interface BookingUpdateResponse {
  id: string
  userId: string
  serviceId: string | null
  masterId: string | null
  locationId: string | null
  status: string
  scheduledAt: string | null
  [key: string]: unknown
}

export async function setBookingService(
  telegramId: string,
  serviceId: string
): Promise<BookingUpdateResponse> {
  const res = await fetch(`${BACKEND_URL}/telegram/bookings/service`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegramId, serviceId }),
  })
  if (!res.ok) return parseError(res)
  return (await res.json()) as BookingUpdateResponse
}

export async function setBookingMaster(
  telegramId: string,
  masterId: string
): Promise<BookingUpdateResponse> {
  const res = await fetch(`${BACKEND_URL}/telegram/bookings/master`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegramId, masterId }),
  })
  if (!res.ok) return parseError(res)
  return (await res.json()) as BookingUpdateResponse
}

export interface CatalogItemResponse {
  id: string
  category: string
  type: string
  gender: string | null
  groupKey: string | null
  titleRu: string
  subtitleRu: string | null
  descriptionRu: string | null
  price: number | null
  durationMin: number | null
  serviceId: string | null
  isVisible: boolean
  service: { id: string; name: string; durationMin: number; price: number } | null
}

export async function getCatalogItemById(id: string): Promise<CatalogItemResponse | null> {
  const res = await fetch(`${BACKEND_URL}/catalog/item/${encodeURIComponent(id)}`)
  if (res.status === 404) return null
  if (!res.ok) return parseError(res)
  return (await res.json()) as CatalogItemResponse
}

export async function setBookingTime(
  telegramId: string,
  scheduledAt: string
): Promise<BookingUpdateResponse> {
  const res = await fetch(`${BACKEND_URL}/telegram/bookings/time`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegramId, scheduledAt }),
  })
  if (!res.ok) return parseError(res)
  return (await res.json()) as BookingUpdateResponse
}

export async function cancelBookingById(
  telegramId: string,
  bookingId: string,
): Promise<BookingUpdateResponse> {
  const res = await fetch(`${BACKEND_URL}/telegram/bookings/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegramId, bookingId }),
  })
  if (!res.ok) return parseError(res)
  return (await res.json()) as BookingUpdateResponse
}
