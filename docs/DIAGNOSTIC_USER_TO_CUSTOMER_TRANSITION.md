# Diagnostic Report: Completing the Transition to Customer-Only Client Bookings

**Scope:** Read-only architecture diagnostic. No code or schema changes.

**Goal:** Assess whether the system can safely complete the transition so that real clients are represented only by Customer, and Booking no longer requires User for client-linked bookings (User = staff/internal only).

---

## A. Current schema reality

**Prisma schema (Booking, User, Customer):**

- **Booking.userId:** `String` (no `?`) — **required** at DB level. FK to `User.id`.
- **Booking.user:** `User` (no `?`) — **required** relation.
- **Booking.customerId:** `String?` — **optional**.
- **Booking.customer:** `Customer?` — optional relation.
- **@@index([userId])** and **@@index([customerId])** both exist.

**Constraints:**

- The DB and Prisma model **require** every booking to have a non-null `userId` and thus a related `User`. There is no way today to create a booking without a User.
- `customerId` is optional; many bookings can exist with only `userId` and no Customer.

**Conclusion:** Making client bookings possible without User linkage requires a schema change: `userId` (and the `user` relation) must become optional (`String?`, `User?`). No other schema change is strictly required for that goal.

---

## B. Booking creation paths and user/customer usage

| Path | File / entry | Requires userId? | Sets customerId? | userId used as |
|------|----------------|------------------|------------------|----------------|
| **1. Telegram POST /bookings** | `telegramBookings.ts` → `BookingService.createBooking(user.id, { customerId, source })` | Yes (user from telegramId) | Yes when phone/customer exists | Client identity (Telegram → User → Booking) |
| **2. Telegram state → BOOKED** | `state.service.ts` → `createBooking(user.id, tx)` | Yes | No | Client identity (same) |
| **3. createBooking (module)** | `booking.service.ts` — `db.booking.create({ userId, status: "PENDING" })` | Yes | No | Client identity |
| **4. BookingService.createBooking** | `BookingService.ts` — `prisma.booking.create({ userId, customerId?, source? })` | Yes | Optional | Client identity; also enforces one active booking per userId |
| **5. Reschedule** | `booking.service.ts` — `rescheduleBookingByTelegramId` → `tx.booking.create({ ...current, masterId, scheduledAt })` | Yes (copies `current.userId`) | Yes (copies `current.customerId`) | Same as original booking |

**Summary:** Every creation path today supplies `userId`. Customer is attached when available (Telegram with phone, reschedule clone). `userId` is used as the client identity for Telegram (and for “one active booking per user” in `BookingService`).

---

## C. Booking read/query paths that depend on userId

| Path | File | What it does | Classification |
|------|------|----------------|----------------|
| **getBookingsByTelegramId** | `booking.service.ts` | User by telegramId → findMany where userId = user.id | Legacy; replaceable by Customer.telegramId + customerId |
| **getUpcomingBookingsByTelegramId** | `booking.service.ts` | Same: user by telegramId → findMany where userId = user.id, scheduledAt > now, PENDING/CONFIRMED | Same |
| **cancelBookingByTelegramId** | `booking.service.ts` | User by telegramId; find booking; assert booking.userId === user.id; cancelBooking(user.id, id) | Legacy; replaceable by “booking belongs to telegramId” via customerId + Customer.telegramId |
| **rescheduleBookingByTelegramId** | `booking.service.ts` | User by telegramId; findFirst where id and userId = user.id; then cancel + create new with current.userId | Same |
| **executeBookingAction** (confirm/cancel/complete) | `booking.service.ts` | findFirst where bookingId and userId; transition status | Used by cancel path above; if cancel/reschedule use customerId, this can stay for “by id + owner” where owner = userId or customerId |
| **Reminders** | `sendBookingReminders.ts` | findMany where status, scheduledAt, serviceId, masterId, **user.telegramId not null**; select includes user.telegramId; send to booking.user.telegramId | Purely for Telegram delivery; can be replaced by “telegramId from user or from booking.customer.telegramId” |
| **Admin booking list** | `admin.routes.ts` | findMany bookings; userIds = [...bookings.map(b => b.userId)]; findMany users by userIds; build client = customer ?? user ?? null | UI fallback; already prefers customer; must not pass null in userIds when userId optional |
| **Admin status notification** | `admin.routes.ts` | findUnique booking with user: { telegramId }; if booking?.user?.telegramId send notification | Purely for Telegram delivery; can use customer.telegramId when userId null |
| **BookingService.getPendingBookingByTelegramId** | `BookingService.ts` | User by telegramId → findFirst booking where userId, status PENDING | Legacy; replaceable by pending booking by customerId (Customer.telegramId) |
| **setServiceByTelegramId etc.** | `BookingService.ts` | Depend on getPendingBookingByTelegramId (userId) | Same |

**Conclusion:** All current userId-dependent reads are either (1) legacy client identity (Telegram “my bookings” / cancel / reschedule / pending), (2) Telegram delivery (reminders, status notification), or (3) admin UI fallback. None are inherently “staff-only”; they can be adapted to customerId + Customer.telegramId for client operations and to optional user for display/notifications.

---

## D. Telegram-specific dependency on User

**Why Telegram still depends on User today:**

1. **Auth / session:** `findOrCreateByTelegram` (telegram.service) finds or creates a **User** by telegramId. All Telegram booking APIs take `telegramId` and resolve to `User` first.
2. **Booking creation:** POST /telegram/bookings requires a User (findUnique by telegramId); creates booking with `user.id`. State machine “BOOKED” also calls `createBooking(user.id, tx)`.
3. **Pending booking:** `getPendingBookingByTelegramId` returns the single PENDING booking for that **userId**. Step endpoints (service, master, time) use this to get the current booking.
4. **Upcoming / list:** `getUpcomingBookingsByTelegramId` and `getBookingsByTelegramId` query by **userId**.
5. **Cancel / reschedule:** Both resolve User by telegramId and enforce `booking.userId === user.id`.
6. **Reminders / notifications:** Send to `booking.user.telegramId`.

**Could Telegram client identity be resolved through Customer.telegramId?**

Yes. Customer already has `telegramId` (unique). So:

- “My upcoming bookings” could be: bookings where `customerId` IN (Customer.id where telegramId = X) and status/scheduledAt/serviceId/masterId as now.
- Cancel / reschedule could allow a booking if it belongs to that telegramId via `booking.customerId` and `Customer.telegramId = telegramId` (and optionally still allow by userId for backward compatibility).
- Pending booking could be: one PENDING booking linked to that Customer (by telegramId). That requires a single “current” booking per Telegram session; today that’s “per User”. It could become “per Customer (telegramId)” or a hybrid (prefer by customerId, fallback by userId during transition).
- Reminders / notifications: send when `booking.user?.telegramId ?? booking.customer?.telegramId` is set.

**If Booking.userId became optional, what Telegram features need adaptation?**

- **Creation:** Either (a) keep creating/finding User and set userId when present (backward compatible), or (b) create booking with only customerId when Customer exists for telegramId, and no User. For (b), “pending booking” must be found by customerId (and possibly still create a User for state machine unless state moves to session/customer).
- **Upcoming / list:** Must return bookings where either `userId` = user from telegramId **or** `customerId` = customer from telegramId (and optionally filter to one “identity” for consistency).
- **Cancel / reschedule:** Must allow when booking is “owned” by this telegramId via userId **or** customerId.
- **Reminders:** Must read telegramId from `user` or `customer`; query must include bookings with either user.telegramId or customer.telegramId.
- **Status notification (admin):** Same: telegramId from user or customer.

No Telegram feature is fundamentally tied to User; all are tied to “telegramId” for delivery and “ownership” for actions. Ownership can be defined as “booking.userId = user.id” or “booking.customerId = customer.id where customer.telegramId = X”.

---

## E. Admin/CRM dependency on User vs Customer

**Screens that already work from customerId:**

- **Booking list:** Builds `client = customer ?? user ?? null` and `customerName = customer?.name ?? user?.name`. So if a booking has `customerId` and no `userId`, we only need to avoid passing `null` in `userIds` when fetching users (e.g. `userIds = bookings.map(b => b.userId).filter(Boolean)`). Then `user` is undefined and `client` comes from customer. Customer link (navigate to customer card) uses `b.customerId`; no change.
- **Customer profile (GET /customers/:id):** Uses `customer.bookings` (relation on customerId). No userId in this flow. Fully Customer-centric.
- **Booking → customer navigation:** Uses `customerId`; no dependency on User.

**Screens that assume or use User:**

- **Booking list:** Fetches users by `bookings.map(b => b.userId)`. If `userId` can be null, this list must exclude nulls so Prisma doesn’t receive null ids. Then `userMap[b.userId]` can be undefined for null userId — already handled by `client = customer ?? user ?? null`.
- **Status change notification:** Loads `booking.user.telegramId`. If `userId` is null, this would need to load `booking.customer.telegramId` (or include customer in the select and use customer.telegramId when user is null).

**Conclusion:** Admin/CRM already prefers Customer for display and navigation. With a small number of changes (don’t pass null in userIds; get telegramId from customer when user is null for notifications), admin works with bookings that have only customerId.

---

## F. Whether customerId is already strong enough to be the client source of truth

**Customer-centric logic already in place:**

- Admin list shows client from customer first, then user fallback.
- Customer profile shows booking history via `customer.bookings` (customerId).
- Reschedule copies `customerId` (and source) to the new booking.
- Telegram flow already creates/updates Customer and sets `customerId` when phone is present.
- Booking list and customer card use `customerId` for “open customer” link.

**Gaps (still User-centric):**

- Telegram “my bookings”, cancel, reschedule, and “pending booking” are keyed by User (telegramId → userId → booking).
- Reminders and status notifications use `booking.user.telegramId`.
- Schema still requires `userId` and thus forces a User for every booking.

**Conclusion:** For **display and CRM navigation**, customerId is already the source of truth. For **Telegram operations and notifications**, the code still uses User as the proxy for “telegramId”. The data model (Customer.telegramId, Booking.customerId) is sufficient to make customerId the single client source of truth; the remaining work is to use it in Telegram and notification paths and to make userId optional.

---

## G. Exact required changes to support bookings without User

**1. Schema / Prisma (must change)**

- In `Booking`: change `userId` to `userId String?` and `user` to `user User?`. Adjust relation if needed so User can have bookings with null userId (Prisma allows optional relation).
- Migration: alter column to nullable; no FK change except nullability. Ensure no application code assumes non-null before deployment.

**2. Booking creation (must change)**

- **Admin/manual booking:** New path already planned; create with `customerId`, `source: "ADMIN"`, **userId: null** (no “manual” User).
- **Telegram POST /bookings:** Either (a) keep creating/finding User and set userId (preserve current behaviour), or (b) create booking with only customerId when Customer exists, and userId = null. For (b), need a “pending booking by telegramId” that finds by Customer.telegramId.
- **State machine BOOKED:** Currently `createBooking(user.id, tx)`. Either keep (if Telegram still uses User) or change to create by customerId when applicable.
- **Reschedule:** When creating the new booking, set `userId: current.userId ?? undefined` (or null). So if original has no userId, new booking has no userId.
- **BookingService.createBooking:** Today requires userId and enforces one active per userId. For admin/manual, do not use this; use a dedicated create that allows null userId. If Telegram moves to customer-only, either deprecate this or add an overload that creates by customerId and allows null userId.

**3. Booking read/query (must change)**

- **getUpcomingBookingsByTelegramId:** Include bookings where (userId = user.id from telegramId) **or** (customerId IN (select id from Customer where telegramId = X)). Merge and dedupe; apply same filters (scheduledAt, status, serviceId, masterId).
- **getBookingsByTelegramId:** Same: query by userId **or** by customerId (Customer.telegramId).
- **cancelBookingByTelegramId:** Allow if (booking.userId === user.id) **or** (booking.customerId and Customer.telegramId === telegramId). Then call a cancel that works by bookingId (e.g. internal cancel by id without userId check, or pass owner type).
- **rescheduleBookingByTelegramId:** Find “current” booking by id and by (userId = user.id **or** customerId with Customer.telegramId). Create new booking with userId: current.userId ?? undefined, customerId: current.customerId, etc.
- **executeBookingAction:** Today takes (userId, bookingId). Either add an internal “cancel/confirm by bookingId only” for admin/customer flows, or extend to accept “owner” by customerId when userId is null.
- **BookingService.getPendingBookingByTelegramId:** Return pending booking by userId (current) **or** by customerId (Customer.telegramId). If both exist, define precedence (e.g. prefer customerId).

**4. Reminders (must change)**

- **sendBookingReminders:** Query bookings that have either `user.telegramId not null` **or** `customer.telegramId not null`. Select/include `customer: { select: { telegramId: true } }`. For each booking, `telegramId = booking.user?.telegramId ?? booking.customer?.telegramId`; skip if null; send to that telegramId.

**5. Admin (should change)**

- **Booking list:** `userIds = [...new Set(bookings.map(b => b.userId).filter(Boolean))]` so Prisma never gets null. Display logic already supports client = customer ?? user ?? null.
- **Status notification:** After status update, when loading booking for Telegram notification, include `customer: { select: { telegramId: true } }`. Use `booking.user?.telegramId ?? booking.customer?.telegramId`; if null, skip send.

**6. Validation / typing (should change)**

- Any DTO or type that assumes `booking.userId` or `booking.user` is non-null must allow null (e.g. in admin API response, reminder job types).
- Ensure no code path does `booking.user.telegramId` without optional chaining or null check once user is optional.

**7. Optional cleanup**

- Gradually stop creating new Users for Telegram clients if moving to customer-only creation; keep User creation only for staff/internal.
- Remove or narrow “one active booking per userId” in BookingService if most bookings are customer-driven (e.g. only apply when userId is non-null).
- Unify “ownership” checks in one place (e.g. “booking belongs to telegramId” = by user or by customer).

---

## H. Risk assessment

**Is now a good time?**

- Yes. The project is pre-launch, with little real client data. The number of places that depend on userId is bounded and identified. Making userId optional and adding customer-based Telegram paths is a contained change set.

**Transition risk: moderate.**

- **Low risk:** Schema change (add nullability) is straightforward. Admin list and customer profile need minimal changes. Reschedule already copies customerId; adding `userId: current.userId ?? undefined` is simple.
- **Moderate risk:** Telegram flow has many call sites (creation, pending, upcoming, cancel, reschedule). Adding “or by customerId (telegramId)” in parallel to existing “by userId” logic reduces regression risk but requires careful testing. Reminders and status notification need to handle both user and customer telegramId.
- **Mitigation:** Implement in phases: (1) schema + admin + reschedule, (2) Telegram read/cancel/reschedule with “customer or user” ownership, (3) reminder/notification fallback to customer.telegramId, (4) optional: Telegram creation with customerId-only when Customer exists.

**Top 3 technical risks:**

1. **Telegram “pending booking” and step flow:** Today the bot expects exactly one PENDING booking per User. If we support bookings without User, we must define how “current” booking is found (e.g. by Customer.telegramId). If both User and Customer can have a pending booking, precedence and idempotency need to be clear.
2. **Reminders and notifications:** If we miss a path and only read `user.telegramId`, bookings with only customerId will never get reminders/notifications. Tests and a one-off check for “bookings with customerId and customer.telegramId but no userId” are useful.
3. **Backward compatibility during rollout:** Existing bookings have userId. New admin bookings may have only customerId. All read paths must handle both (e.g. “owner” = user or customer). Rolling out without a clear “owner” definition could cause “not found” or wrong booking for some users.

---

## I. Recommended migration sequence

**Phase 1: Schema and non-Telegram paths**

1. Make `Booking.userId` (and `user` relation) optional in Prisma; run migration.
2. Admin booking list: build `userIds` excluding null; keep `client = customer ?? user ?? null`.
3. Admin status notification: load customer.telegramId when present; use `booking.user?.telegramId ?? booking.customer?.telegramId`.
4. Reschedule: set `userId: current.userId ?? undefined` (and keep customerId/source) on the new booking.
5. Manual Booking v1 (admin create): create with `customerId`, `source: "ADMIN"`, `userId: null`.

**Phase 2: Telegram read and actions**

6. `getUpcomingBookingsByTelegramId`: also find bookings by Customer.telegramId; merge with existing userId-based result; dedupe by booking id.
7. `getBookingsByTelegramId`: same.
8. `cancelBookingByTelegramId`: allow ownership by customerId + Customer.telegramId; call internal cancel by bookingId when authorized.
9. `rescheduleBookingByTelegramId`: find current booking by id and (userId = user.id **or** customerId + Customer.telegramId); create new with same userId/customerId rules as reschedule today.
10. `executeBookingAction` or internal cancel: ensure cancel/confirm can be called by bookingId when the caller has established ownership (e.g. via Telegram or admin).

**Phase 3: Reminders and notifications**

11. Reminders: extend query to include bookings with customer.telegramId; select customer.telegramId; use user?.telegramId ?? customer?.telegramId when sending.
12. Re-check admin status notification (done in Phase 1).

**Phase 4 (optional): Telegram creation without User**

13. Optionally, when creating a booking from Telegram, if Customer exists for telegramId, create booking with only customerId (and source BOT), userId null. Pending booking lookup then uses Customer.telegramId. State machine may still use User for “BOOKING_FLOW” state, or be refactored to session/customer.

**Ordering rationale:** Schema first so that new data can have null userId; then admin and reschedule so Manual Booking v1 and existing flows are consistent; then Telegram so bot keeps working and gains customer-based ownership; then reminders so no client loses notifications; finally optional removal of User from Telegram creation.

---

## J. Final recommendation: should we do this now before Manual Booking v1?

**Yes, do the transition before or as part of Manual Booking v1.**

**Reasons:**

1. **Avoids fake Users:** Manual Booking v1 would otherwise require a “manual booking” or “system” User for clients without Telegram. Making userId optional lets admin create bookings with only customerId and no User, which matches the target architecture (User = staff/internal, Customer = clients).
2. **Single model:** After the change, “client” is always Customer (and optionally User for legacy/Telegram). Manual Booking v1 then only creates with customerId + source ADMIN; no special-case User.
3. **Limited blast radius:** Pre-launch and small data mean few edge cases and easy validation. The list of affected paths is known and finite.
4. **Cleaner long-term:** Doing it now prevents reinforcing User-as-client in new features (e.g. more “manual User” hacks) and makes reminders/notifications consistently “by customer or user telegramId”.

**Pragmatic approach:**

- Implement **Phase 1** (schema, admin list/notification, reschedule, Manual Booking v1 with userId null) first. That delivers Manual Booking v1 without any fake User and aligns schema with the target model.
- Then implement **Phase 2** (Telegram read/actions by customer or user) and **Phase 3** (reminders/notifications). That completes the transition for Telegram and notifications without breaking existing Telegram users (who still have User and userId on their bookings).

**End of report.**
