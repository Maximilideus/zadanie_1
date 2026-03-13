# Diagnostic Report: Manual Booking v1 — Implementation Plan

**Scope:** Read-only product and architecture diagnostic. No code changes.

**Goal:** Prepare a precise implementation plan for Manual Booking v1 (admin creates a booking from the admin panel), using the current architecture and existing booking logic.

---

## A. Current admin booking-related capabilities

**What the admin panel can do today:**

| Capability | Present? | Where |
|------------|----------|--------|
| **View bookings** | Yes | `AdminBookingsPage.jsx` — list with filters (status, date range, master). Data from `GET /admin/bookings` (`admin.routes.ts` bookings list). |
| **Update booking status** | Yes | Same page: actions "Подтвердить", "Отменить", "Завершить". Calls `PATCH /admin/bookings/:id/status`. Handler in `admin.routes.ts` uses `updateBookingStatus(id, newStatus)`; sends Telegram notification if `booking.user.telegramId` exists. |
| **Reschedule bookings** | No | No admin reschedule route or UI. Reschedule exists only for Telegram: `POST /bookings/reschedule` (telegram `bookingSteps.ts`). |
| **Cancel bookings** | Yes | Via status change to CANCELLED on the same page. |
| **Create bookings** | No | No "new booking" button, no create-booking modal/page, no `POST` admin booking create endpoint. |

**Files involved:**

- **Frontend:** `frontend/src/pages/AdminBookingsPage.jsx` (list, filters, status actions), `frontend/src/pages/AdminCustomerDetailPage.jsx` (customer card, booking history table, edit customer — no "create booking" button), `frontend/src/api/admin.js` (`getAdminBookings`, `updateAdminBookingStatus`, `getAdminMasters`, etc.).
- **Backend:** `backend/src/modules/admin/admin.routes.ts` — `GET /bookings` (list), `PATCH /bookings/:id/status` (status update). No POST for creating bookings.

**Conclusion:** Admin can view and change status only. There is no existing UI or API for creating a booking or for reschedule; Manual Booking v1 will be a new flow.

---

## B. Existing booking creation paths in backend

| Path | Entry | How booking is created | customerId / source |
|------|--------|------------------------|----------------------|
| **1. Telegram initial create** | `POST /telegram/bookings` (`telegramBookings.ts`) | `BookingService.createBooking(user.id, { customerId, source: customerId ? "BOT" : undefined })` | Set from findOrCreateFromTelegram / customerHasPhone. |
| **2. Telegram step-by-step** | Bot flow: create empty → set service → master → time | `createBooking(userId)` in `modules/booking/booking.service.ts` (empty shell); then `BookingService.setServiceByTelegramId`, `setMasterByTelegramId`, `setScheduledAtByTelegramId` | customerId/source set at initial POST /telegram/bookings only. |
| **3. Reschedule** | `POST /telegram/bookings/reschedule` | `rescheduleBookingByTelegramId` in `modules/booking/booking.service.ts`: cancel old + `tx.booking.create` with full payload including customerId/source from original. | Preserved from original booking. |
| **4. BookingService (class)** | Used by Telegram routes | `prisma.booking.create({ userId, status: "PENDING", customerId, source })` in `services/BookingService.ts`. Options type is `{ customerId?: string; source?: "BOT" }` — **ADMIN not in type**. | BOT only in type. |
| **5. createBooking (module)** | Used by user state machine | `modules/booking/booking.service.ts` `createBooking(userId, tx)` — creates only `{ userId, status: "PENDING" }`, no customerId/source. | Not set. |

**Main source of truth for “full” create:** Either `BookingService.createBooking` (with options) or direct `prisma.booking.create`. There is **no** backend path today that creates a booking with `source: "ADMIN"`. The enum `BookingSource` already has `ADMIN` in the schema and migration; it is simply unused at create time.

**Suitable for admin-created bookings:** A **new** admin-only path is needed. Reusing `BookingService.createBooking` would require extending the options type to allow `source: "ADMIN"` and would still run the **ACTIVE_BOOKING_EXISTS** check per `userId`, which is tuned for “one active booking per Telegram user” and is not suitable for multiple manual bookings. So the smallest safe approach is a dedicated admin create-booking handler that performs a single `prisma.booking.create` (or a small helper) with the needed fields, **without** the active-booking-per-user check.

---

## C. Availability logic and whether it can be reused

**Where slots are calculated:** `backend/src/services/AvailabilityService.ts` — `getAvailableSlots({ serviceId, masterId, date })`. It:

- Loads service (duration, location, category, groupKey), validates ELECTRO bookability.
- Loads master (role MASTER, isActive).
- Builds working intervals from `WorkingHour` for that master and day.
- Subtracts `Exception` and `Appointment` intervals.
- Subtracts existing **Booking** intervals (PENDING/CONFIRMED) for that master/location/day.
- Returns slot starts at 15‑minute steps, in ISO UTC.

**Who calls it:**  
- `backend/src/routes/telegram/availability.ts` (under telegram prefix) — `GET /telegram/availability?serviceId&masterId&date`.  
- `backend/src/modules/booking/booking.service.ts` — `rescheduleBookingByTelegramId` (slot validation).  
There is **no** admin-scoped availability route; the Telegram one is not necessarily protected by admin JWT.

**Telegram-specific behaviour:**  
- `getAvailableSlots` throws `DATE_IS_TODAY` when `date === todayStr` (no same-day slots).  
- Throws `DATE_OUT_OF_RANGE` for past or beyond 60 days.  
Otherwise it is service/master/date driven and has no Telegram-specific data.

**Reuse for Manual Booking v1:** The same `getAvailableSlots` can be used. Options:

- Add `GET /admin/availability` with the same query params, protected by admin auth, calling `getAvailableSlots`.  
- Or, if product wants same-day for admin only, add an optional `allowToday` (or similar) and relax the `DATE_IS_TODAY` check when that flag is true; keep the rest of the logic unchanged.

No separate scheduling engine is needed; reuse the existing availability service.

---

## D. Minimum backend data required for a manual booking

**From Prisma schema (`Booking`):**

- **Required:** `userId` (FK to User), `status` (default PENDING).
- **Optional but needed for a meaningful booking:** `serviceId`, `masterId`, `scheduledAt`, `locationId` (can be derived from service), `customerId`, `source`.

**Minimum payload for Manual Booking v1:**

- `customerId` — required for CRM linkage (manual booking is for a known customer).
- `serviceId` — required for slot calculation and display.
- `masterId` — required for slot calculation and display.
- `scheduledAt` — required (ISO string or equivalent).
- `locationId` — can be taken from `Service.locationId` if not sent.
- `source: "ADMIN"` — so the booking is clearly admin-created.
- `userId` — **required by schema**. Not optional.

**userId requirement:**  
The schema has `userId String` (required) and `user User @relation(...)`. So every booking must reference a User. There is no “booking without user” in the current model.

**How to supply userId for admin-created bookings:**

1. **Customer has `telegramId`:** Resolve `User` by `Customer.telegramId` and use that `user.id`. Then the same person’s Telegram and manual bookings share one User; reminders (which use `booking.user.telegramId`) continue to work for that booking.
2. **Customer has no `telegramId`:** There is no User for that customer. The schema still requires a User. Options that avoid schema change:
   - **Single “manual booking” User:** One dedicated User record (e.g. email like `manual@system`, role CLIENT) used as `userId` for all admin-created bookings where the customer has no Telegram. Reminders correctly skip these (no `telegramId`). This is a data/seed concern, not a schema change.
   - **Create a User per customer:** Would require new User records and possibly schema or process for “shadow” users; heavier and not minimal.

**Conclusion:** Minimum data for manual booking: `customerId`, `serviceId`, `masterId`, `scheduledAt`, and implicitly `source: "ADMIN"`. `locationId` from service. `userId`: use Customer’s User when `Customer.telegramId` exists, else a single designated “manual booking” User.

---

## E. User vs Customer constraint for admin-created bookings

**Can a manual booking be created for a Customer without a User?**  
**No.** The Booking model requires `userId`. A Customer without `telegramId` is not linked to any User. So we cannot create a booking with “customer only, no user” without changing the schema.

**If not, why not?**  
The database enforces `userId` as a non-nullable FK to User. The codebase and reminders assume `booking.user` (and `booking.user.telegramId` for notifications).

**Existing pattern for non-Telegram bookings?**  
There is no existing path that creates a booking without a real Telegram User. Reschedule reuses the original booking’s `userId`. So there is no “customer-only” booking today.

**Does source = ADMIN imply a different path?**  
`ADMIN` exists in the enum but is never set at creation. It can mean “created from admin panel”; it does not change the schema requirement for `userId`. The difference is only who creates it and how `userId` is chosen (e.g. customer’s User vs system User).

**Safest approach without rewriting architecture:**  
- **Do not** make `userId` optional.  
- For manual booking: **require** selecting an existing Customer (from CRM).  
- **Resolve userId:** if `Customer.telegramId` is set, find `User` by `telegramId` and use that `user.id`; otherwise use a single designated “manual booking” User id (constant or from config/DB).  
- Set `customerId` and `source: "ADMIN"` on the new booking.  
This keeps the current model, preserves reminders for Telegram-linked customers, and avoids schema changes.

---

## F. Best MVP entrypoint for Manual Booking v1

**Possible entrypoints:**

| Entrypoint | Exists? | Pros | Cons |
|------------|--------|------|------|
| Customer card | Yes (`AdminCustomerDetailPage`) | Customer already chosen; natural “record for this client”. | Need to add one primary CTA (e.g. “Новая запись”). |
| Bookings page | Yes (`AdminBookingsPage`) | Central place for all bookings. | Would need customer picker first. |
| Calendar / day schedule | Not found | — | Would require new screen. |
| Booking list toolbar | Yes (filters only) | Could add “Новая запись”. | Still need customer selection. |
| Customer booking history block | Yes (section on customer card) | Same as “from customer card”. | — |

**Recommendation:** **Start from the customer card** for v1.  
- One clear flow: open customer → “Новая запись” → service → master → date → time (reusing availability) → confirm → create.  
- No need for a global customer search in the first step.  
- Fits “manual booking for a known client” and reuses existing customer list and detail APIs.

Secondary option: add “Новая запись” on the bookings page that opens a modal or page where the first step is “choose customer” (reuse admin customers list/search). Same backend, different entrypoint.

---

## G. Reusable admin UI/components already available

**Existing data/API (can be reused for forms):**

- **Customers:** `getAdminCustomers`, `getAdminCustomer(id)` — list and detail.
- **Services:** `getAdminServices(params)` — e.g. `bookableOnly`, `locationId`, `category`.
- **Masters:** `getAdminMasters()` — list of masters.
- **Locations:** `getAdminLocations()`.

**Missing for v1:**

- **Availability:** No admin API. Need `GET /admin/availability?serviceId&masterId&date` (or equivalent) that returns slots (reuse `getAvailableSlots`).
- **Create booking:** No `POST /admin/bookings` (or similar).

**Existing UI patterns (reuse patterns, not necessarily components):**

- Date input: used in booking filters (`AdminBookingsPage` — `type="date"`).
- Selects: status, master filters (dropdowns).
- Tables: bookings, customer booking history.
- Cards/sections: customer detail page layout.
- No existing **service picker**, **master picker**, or **time-slot grid** in admin; these exist in the Telegram bot flow. For admin, v1 can use simple dropdowns + date input + list of slots (from new availability endpoint).

**Conclusion:** Reuse existing API for customers, services, masters, locations. Add admin availability endpoint and admin create-booking endpoint. UI: add a flow (page or modal) with customer fixed when from customer card; then service → master → date → time (slots) → confirm; reuse existing select/input/button patterns.

---

## H. Business rules that Manual Booking v1 must respect

**Already enforced in backend (must keep):**

- **Service:** Exists, bookable; ELECTRO only if `category === "ELECTRO"` and `groupKey === "time"` (`assertElectroServiceBookable` in AvailabilityService and BookingService).
- **Master:** Exists, role MASTER, isActive; master must be linked to service (`MasterService`).
- **Slots:** From `getAvailableSlots` — working hours, exceptions, appointments, existing bookings; 15‑minute step; duration from service.
- **Status:** Default PENDING; valid transitions via `updateBookingStatus` / status machine.
- **Reminders:** Sent only when `booking.user.telegramId` is set (no change needed for manual bookings with system User).

**Validation the new admin create flow should do:**

- Customer exists and is allowed for manual booking (e.g. must select from CRM).
- Service + master + scheduledAt in the allowed slot set (call `getAvailableSlots` and check `scheduledAt` is in the list, or equivalent).
- `scheduledAt` within the same range the availability engine uses (e.g. not today if reusing current behaviour, or allow today if product adds that).
- No need to enforce “one active booking per user” for the manual-booking User (by design).

**Where enforced:** Slot and service/master rules are in `AvailabilityService` and (for Telegram) in `BookingService` / `booking.service.ts`. The new admin create handler should call the same availability check and create the booking only if the chosen time is valid.

---

## I. ELECTRO-specific considerations

- **Bookable ELECTRO:** Only services with `category === "ELECTRO"` and `groupKey === "time"` (duration-based). Zone-only ELECTRO is not bookable (`electroBookingGuard`).
- **Representation:** ELECTRO time services are normal services with `durationMin`; they appear in service lists and in availability like any other bookable service.
- **Manual booking:** Admin can list bookable services (existing `getAdminServices` with filters); ELECTRO time services are included. No separate “ELECTRO path” is needed; same service → master → date → time flow applies.
- **Blockers:** None identified. Use the same `assertElectroServiceBookable` and `getAvailableSlots`; manual booking does not need a different ELECTRO model.

---

## J. Recommended smallest safe implementation approach

**Principles:**  
- No schema change.  
- No rewrite of booking or availability engine.  
- Reuse existing availability and validation; add one admin create path and minimal UI.

**Backend (minimal):**

1. **UserId resolution**
   - When creating a manual booking for a given `customerId`: load Customer. If `Customer.telegramId` is set, find User by `telegramId` and use that `user.id`. Otherwise use a single designated “manual booking” User id (ensure one such User exists in DB, e.g. via seed or migration data).
2. **Admin availability**
   - Add `GET /admin/availability` (or under existing admin prefix) with query `serviceId`, `masterId`, `date`. Protect with admin auth. Handler calls `getAvailableSlots({ serviceId, masterId, date })` and returns `{ timezone, slots }`. Optionally support same-day for admin (e.g. query flag and relax `DATE_IS_TODAY` in a small wrapper or inside `getAvailableSlots`).
3. **Admin create booking**
   - Add `POST /admin/bookings` (or `POST /admin/bookings/create`) with body: `customerId`, `serviceId`, `masterId`, `scheduledAt` (ISO string). Validate: customer exists; resolve userId (customer’s User or manual User); load service (for `locationId`, duration); validate master and master–service link; call `getAvailableSlots` for the date of `scheduledAt` and ensure `scheduledAt` is in the returned slots; then `prisma.booking.create` with `userId`, `customerId`, `serviceId`, `masterId`, `locationId`, `scheduledAt`, `status: "PENDING"`, `source: "ADMIN"`. Do **not** use `BookingService.createBooking` (to avoid ACTIVE_BOOKING_EXISTS). Return the created booking (or id and minimal fields).
4. **No change** to Telegram routes, reschedule, or status update logic.

**Frontend (minimal):**

1. **Entrypoint**
   - From customer card: add button “Новая запись” on `AdminCustomerDetailPage` that opens a create-booking flow (new page or modal) with customer fixed to the current customer.
2. **Flow**
   - Steps: (1) Customer fixed (from context). (2) Choose service (dropdown from `getAdminServices`). (3) Choose master (dropdown from `getAdminMasters`, optionally filtered by service if backend exposes masters by service). (4) Choose date (date input). (5) Load slots via new admin availability API; choose time. (6) Summary + confirm. (7) POST to new admin create-booking endpoint.
3. **Reuse**
   - Existing admin API for customers, services, masters; existing patterns for selects and buttons; no need for a full calendar or drag-and-drop.

**Edge cases to handle:**

- Customer has no User and no “manual booking” User in DB: creation fails with a clear error until the designated User exists.
- Chosen time not in slots (e.g. race with another booking): backend rejects with a clear error; frontend can refetch slots and ask to pick again.
- Same-day: if product wants it for admin, add optional support in availability (e.g. `allowToday`) and document; otherwise keep current “no today” behaviour for v1.

**Summary:**  
Manual Booking v1 = one new backend create path (userId from customer or system User, validation via existing `getAvailableSlots`), one new admin availability endpoint, and one new UI flow (customer card → service → master → date → time → create), reusing existing CRM, services, masters, and availability logic. No schema change, no duplication of scheduling logic, and no change to Telegram or existing admin status/reschedule behaviour.

---

**End of report.**
