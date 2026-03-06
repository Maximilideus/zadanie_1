// ── Step enum ────────────────────────────────────────────────────────

export type BookingFlowStep =
  | "idle"
  | "entry"    // deep-link landing screen only
  | "service"
  | "master"
  | "date"
  | "time"
  | "confirm"

// ── Catalog display data (from CatalogItem) ─────────────────────────

export type CatalogData = {
  catalogItemId: string | null
  category: string
  title: string | null
  price: number | null
  durationMin: number | null
  serviceName: string | null
}

// ── Booking operational data ─────────────────────────────────────────

export type BookingData = {
  serviceId: string | null
  serviceName: string | null
  durationMin: number | null
  masterId: string | null
  masterName: string | null
  date: string | null       // YYYY-MM-DD
  time: string | null       // ISO UTC string
}

// ── Confirm helper state ─────────────────────────────────────────────

export type ConfirmState = {
  idempotencyKey: string | null
  inProgress: boolean
  lastAttemptAt: string | null  // ISO string
}

// ── Top-level session ────────────────────────────────────────────────

export type BookingFlowSession = {
  step: BookingFlowStep
  catalog: CatalogData | null
  booking: BookingData
  confirm: ConfirmState
}

// ── Step ordering (used for recovery and validation) ─────────────────

const OPERATIONAL_STEPS: BookingFlowStep[] = [
  "service", "master", "date", "time", "confirm",
]

const STEP_ORDER: Record<BookingFlowStep, number> = {
  idle: 0,
  entry: 1,
  service: 2,
  master: 3,
  date: 4,
  time: 5,
  confirm: 6,
}

// ── Internal helpers ─────────────────────────────────────────────────

const EMPTY_BOOKING: BookingData = {
  serviceId: null,
  serviceName: null,
  durationMin: null,
  masterId: null,
  masterName: null,
  date: null,
  time: null,
}

const EMPTY_CONFIRM: ConfirmState = {
  idempotencyKey: null,
  inProgress: false,
  lastAttemptAt: null,
}

function clearBookingFrom(
  booking: BookingData,
  step: BookingFlowStep,
): BookingData {
  const idx = STEP_ORDER[step]
  return {
    serviceId:   idx <= STEP_ORDER.service ? null : booking.serviceId,
    serviceName: idx <= STEP_ORDER.service ? null : booking.serviceName,
    durationMin: idx <= STEP_ORDER.service ? null : booking.durationMin,
    masterId:    idx <= STEP_ORDER.master  ? null : booking.masterId,
    masterName:  idx <= STEP_ORDER.master  ? null : booking.masterName,
    date:        idx <= STEP_ORDER.date    ? null : booking.date,
    time:        idx <= STEP_ORDER.time    ? null : booking.time,
  }
}

// ── Factory ──────────────────────────────────────────────────────────

export function createEmptyBookingFlowSession(): BookingFlowSession {
  return {
    step: "idle",
    catalog: null,
    booking: { ...EMPTY_BOOKING },
    confirm: { ...EMPTY_CONFIRM },
  }
}

// ── Deep-link entry ──────────────────────────────────────────────────

export function startFromCatalogItem(
  session: BookingFlowSession,
  item: {
    catalogItemId: string
    category: string
    title: string
    price: number | null
    durationMin: number | null
    serviceId: string
    serviceName: string
  },
): BookingFlowSession {
  return {
    step: "entry",
    catalog: {
      catalogItemId: item.catalogItemId,
      category: item.category,
      title: item.title,
      price: item.price,
      durationMin: item.durationMin,
      serviceName: item.serviceName,
    },
    booking: {
      ...EMPTY_BOOKING,
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      durationMin: item.durationMin,
    },
    confirm: { ...EMPTY_CONFIRM },
  }
}

// ── Manual entry ─────────────────────────────────────────────────────

export function startManualFlow(
  _session: BookingFlowSession,
): BookingFlowSession {
  return {
    step: "service",
    catalog: null,
    booking: { ...EMPTY_BOOKING },
    confirm: { ...EMPTY_CONFIRM },
  }
}

// ── Step setters ─────────────────────────────────────────────────────

/** Set service from catalog selection (deep-link "entry" -> next step). */
export function setCatalogItemSelection(
  session: BookingFlowSession,
): BookingFlowSession {
  return {
    ...session,
    step: "master",
    confirm: { ...EMPTY_CONFIRM },
  }
}

export function setMasterSelection(
  session: BookingFlowSession,
  masterId: string,
  masterName: string,
): BookingFlowSession {
  return {
    ...session,
    step: "date",
    booking: {
      ...session.booking,
      masterId,
      masterName,
      date: null,
      time: null,
    },
    confirm: { ...EMPTY_CONFIRM },
  }
}

export function setDateSelection(
  session: BookingFlowSession,
  date: string,
): BookingFlowSession {
  return {
    ...session,
    step: "time",
    booking: {
      ...session.booking,
      date,
      time: null,
    },
    confirm: { ...EMPTY_CONFIRM },
  }
}

export function setTimeSelection(
  session: BookingFlowSession,
  time: string,
): BookingFlowSession {
  return {
    ...session,
    step: "confirm",
    booking: {
      ...session.booking,
      time,
    },
    confirm: { ...EMPTY_CONFIRM },
  }
}

// ── Navigation ───────────────────────────────────────────────────────

const BACK_MAP: Record<BookingFlowStep, BookingFlowStep> = {
  idle: "idle",
  entry: "idle",
  service: "idle",
  master: "service",
  date: "master",
  time: "date",
  confirm: "time",
}

/** Go one step back. Does not clear already-chosen data. */
export function goBack(session: BookingFlowSession): BookingFlowSession {
  const prev = BACK_MAP[session.step]
  // Deep-link flow skips "service": master -> entry
  const target =
    prev === "service" && session.catalog != null ? "entry" : prev

  return {
    ...session,
    step: target,
    confirm: target !== "confirm" ? { ...EMPTY_CONFIRM } : session.confirm,
  }
}

export function goHome(_session: BookingFlowSession): BookingFlowSession {
  return createEmptyBookingFlowSession()
}

export function cancelFlow(_session: BookingFlowSession): BookingFlowSession {
  return createEmptyBookingFlowSession()
}

/**
 * Jump to service selection while preserving catalog category context.
 * Clears all booking selections so the user starts fresh.
 */
export function chooseAnotherService(
  session: BookingFlowSession,
): BookingFlowSession {
  return {
    step: "service",
    catalog: session.catalog
      ? {
          category: session.catalog.category,
          catalogItemId: null,
          title: null,
          price: null,
          durationMin: null,
          serviceName: null,
        }
      : null,
    booking: { ...EMPTY_BOOKING },
    confirm: { ...EMPTY_CONFIRM },
  }
}

// ── Validation helpers ───────────────────────────────────────────────

export function canEnterStep(
  session: BookingFlowSession,
  target: BookingFlowStep,
): boolean {
  switch (target) {
    case "idle":
      return true
    case "entry":
      return session.catalog != null
    case "service":
      return true
    case "master":
      return session.booking.serviceId != null
    case "date":
      return session.booking.serviceId != null
        && session.booking.masterId != null
    case "time":
      return session.booking.serviceId != null
        && session.booking.masterId != null
        && session.booking.date != null
    case "confirm":
      return canConfirm(session)
  }
}

/** Returns the earliest operational step whose data is missing. */
export function getEarliestMissingStep(
  session: BookingFlowSession,
): BookingFlowStep {
  if (session.booking.serviceId == null) {
    return session.catalog != null ? "entry" : "service"
  }
  if (session.booking.masterId == null)  return "master"
  if (session.booking.date == null)      return "date"
  if (session.booking.time == null)      return "time"
  return "confirm"
}

export function canConfirm(session: BookingFlowSession): boolean {
  return (
    session.catalog?.catalogItemId != null &&
    session.booking.serviceId != null &&
    session.booking.masterId != null &&
    session.booking.date != null &&
    session.booking.time != null
  )
}

// ── Confirm lifecycle ────────────────────────────────────────────────

export function ensureConfirmAttempt(
  session: BookingFlowSession,
  idempotencyKey: string,
  nowIso: string,
): BookingFlowSession {
  if (session.confirm.idempotencyKey === idempotencyKey) {
    return session
  }
  return {
    ...session,
    confirm: {
      idempotencyKey,
      inProgress: false,
      lastAttemptAt: nowIso,
    },
  }
}

export function setConfirmInProgress(
  session: BookingFlowSession,
  inProgress: boolean,
): BookingFlowSession {
  return {
    ...session,
    confirm: {
      ...session.confirm,
      inProgress,
    },
  }
}

export function clearConfirmState(
  session: BookingFlowSession,
): BookingFlowSession {
  return {
    ...session,
    confirm: { ...EMPTY_CONFIRM },
  }
}
