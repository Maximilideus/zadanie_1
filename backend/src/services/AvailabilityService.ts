import { DateTime } from "luxon"
import { prisma } from "../lib/prisma"
import { SALON_TIMEZONE } from "../config/salon"

const SLOT_STEP_MINUTES = 15
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export interface GetAvailableSlotsParams {
  serviceId: string
  masterId: string
  date: string
}

export interface AvailableSlotsResult {
  timezone: string
  slots: string[]
}

type Interval = { start: DateTime; end: DateTime }

function parseHHMM(s: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (!match) return { hour: 0, minute: 0 }
  return {
    hour: parseInt(match[1], 10),
    minute: parseInt(match[2], 10),
  }
}

function subtractInterval(a: Interval, b: Interval): Interval[] {
  const overlapStart = a.start > b.start ? a.start : b.start
  const overlapEnd = a.end < b.end ? a.end : b.end
  if (overlapStart >= overlapEnd) return [a]
  const result: Interval[] = []
  if (a.start < overlapStart) result.push({ start: a.start, end: overlapStart })
  if (overlapEnd < a.end) result.push({ start: overlapEnd, end: a.end })
  return result
}

export async function getAvailableSlots(
  params: GetAvailableSlotsParams
): Promise<AvailableSlotsResult> {
  const { serviceId, masterId, date } = params

  if (!DATE_REGEX.test(date)) throw new Error("INVALID_DATE")

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { durationMin: true, locationId: true },
  })
  if (!service) throw new Error("NOT_FOUND")
  const timezone = SALON_TIMEZONE
  const locationId = service.locationId
  const durationMin = service.durationMin

  const dayStart = DateTime.fromISO(`${date}T00:00:00`, { zone: timezone })
  if (!dayStart.isValid) throw new Error("INVALID_DATE")

  const nowInTz = DateTime.now().setZone(timezone)
  const todayStr = nowInTz.toFormat("yyyy-MM-dd")
  const maxStr = nowInTz.plus({ days: 60 }).toFormat("yyyy-MM-dd")
  if (date < todayStr) throw new Error("DATE_OUT_OF_RANGE")
  if (date === todayStr) throw new Error("DATE_IS_TODAY")
  if (date > maxStr) throw new Error("DATE_OUT_OF_RANGE")

  const dayOfWeek = dayStart.weekday
  const dayEnd = dayStart.endOf("day")
  const dayStartUtc = dayStart.toUTC().toJSDate()
  const dayEndUtc = dayEnd.toUTC().toJSDate()

  // Master-specific availability only: do NOT use legacy rows with masterId = null
  const workingHours = await prisma.workingHour.findMany({
    where: { masterId, dayOfWeek },
    select: { startTime: true, endTime: true },
  })
  if (workingHours.length === 0) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[availability] masterId=%s date=%s dayOfWeek=%s masterRows=0 → 0 slots (no fallback to null-master rows)", masterId, date, dayOfWeek)
    }
    return { timezone, slots: [] }
  }
  if (process.env.NODE_ENV !== "production") {
    console.debug("[availability] masterId=%s date=%s masterRows=%s", masterId, date, workingHours.length)
  }

  let workingIntervals: Interval[] = workingHours.map((wh) => {
    const startTm = parseHHMM(wh.startTime)
    const endTm = parseHHMM(wh.endTime)
    return {
      start: dayStart.set({
        hour: startTm.hour,
        minute: startTm.minute,
        second: 0,
        millisecond: 0,
      }),
      end: dayStart.set({
        hour: endTm.hour,
        minute: endTm.minute,
        second: 0,
        millisecond: 0,
      }),
    }
  })

  const exceptions = await prisma.exception.findMany({
    where: {
      date: { gte: dayStartUtc, lte: dayEndUtc },
      OR: [{ locationId }, { masterId }],
    },
    select: { startAt: true, endAt: true },
  })

  for (const e of exceptions) {
    if (e.startAt == null && e.endAt == null) return { timezone, slots: [] }
    if (e.startAt == null || e.endAt == null) continue
    const exStart = DateTime.fromJSDate(e.startAt, { zone: timezone })
    const exEnd = DateTime.fromJSDate(e.endAt, { zone: timezone })
    const exInterval = { start: exStart, end: exEnd }
    workingIntervals = workingIntervals.flatMap((w) => subtractInterval(w, exInterval))
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      masterId,
      locationId,
      startAt: { lt: dayEndUtc },
      endAt: { gt: dayStartUtc },
    },
    select: { startAt: true, endAt: true },
  })

  for (const a of appointments) {
    const appStart = DateTime.fromJSDate(a.startAt, { zone: timezone })
    const appEnd = DateTime.fromJSDate(a.endAt, { zone: timezone })
    const appInterval = { start: appStart, end: appEnd }
    workingIntervals = workingIntervals.flatMap((w) => subtractInterval(w, appInterval))
  }

  const nowUtc = new Date()
  const bookings = await prisma.booking.findMany({
    where: {
      masterId,
      scheduledAt: { not: null, gte: dayStartUtc, lte: dayEndUtc },
      OR: [
        { status: "CONFIRMED" },
        { status: "PENDING", expiresAt: { not: null, gt: nowUtc } },
      ],
    },
    select: { scheduledAt: true },
  })

  for (const b of bookings) {
    if (!b.scheduledAt) continue
    const bookStart = DateTime.fromJSDate(b.scheduledAt, { zone: timezone })
    const bookEnd = bookStart.plus({ minutes: durationMin })
    const bookInterval = { start: bookStart, end: bookEnd }
    workingIntervals = workingIntervals.flatMap((w) => subtractInterval(w, bookInterval))
  }

  const slotStarts: DateTime[] = []

  for (const interval of workingIntervals) {
    let slotStart = interval.start
    while (slotStart.plus({ minutes: durationMin }) <= interval.end) {
      if (slotStart >= nowInTz) slotStarts.push(slotStart)
      slotStart = slotStart.plus({ minutes: SLOT_STEP_MINUTES })
    }
  }

  const slotsUtc = slotStarts
    .map((dt) => dt.toUTC().toISO()!)
    .filter(Boolean)
    .sort()

  if (process.env.NODE_ENV !== "production") {
    console.debug("[availability] masterId=%s date=%s slots=%s", masterId, date, slotsUtc.length)
  }
  return { timezone, slots: slotsUtc }
}
