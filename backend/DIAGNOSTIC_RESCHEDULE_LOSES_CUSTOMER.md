# Diagnostic Report: Rescheduled Booking Loses CRM Client Linkage

**Scope:** Read-only production diagnostic. No code changes.

**Question:** Why does the newly created booking during reschedule lose `customerId` (and CRM/Customer linkage), even though the original booking has it?

---

## A. Reschedule Flow Entry Point

- **Route:** `POST /bookings/reschedule` (registered in `backend/src/routes/telegram/bookingSteps.ts`, lines 135–141).
- **Handler:** `rescheduleBookingHandler` (same file, lines 97–103). It parses body `{ telegramId, bookingId, masterId, scheduledAt }` and calls `rescheduleBookingByTelegramId(telegramId, bookingId, masterId, scheduledAt)` from `backend/src/modules/booking/booking.service.ts`.
- **Service:** `rescheduleBookingByTelegramId` in `backend/src/modules/booking/booking.service.ts` (lines 186–283) is the only reschedule implementation found. There is **no** separate admin reschedule route or handler; admin routes under `backend/src/modules/admin/admin.routes.ts` contain no reschedule/transfer/move booking logic.
- **Behaviour:** Reschedule **creates a new booking** and **cancels the original**. Inside a transaction it: (1) updates the current booking to `CANCELLED` with `cancelledAt`; (2) creates a new booking with `tx.booking.create(...)` and returns that new booking. The observed “new booking without customer link” matches this path.

---

## B. How the New Booking Is Created

The new booking is created in **`backend/src/modules/booking/booking.service.ts`** inside `rescheduleBookingByTelegramId`, in the `prisma.$transaction` callback (lines 247–282):

```ts
const newBooking = await tx.booking.create({
  data: {
    userId: current.userId,
    serviceId: current.serviceId,
    locationId,
    masterId: newMasterId,
    scheduledAt: parsedScheduledAt,
    status: "PENDING",
  },
  select: { ... },
})
```

- **No** `customerId` in `data`.
- **No** `source` in `data`.

So the new row is created with Prisma defaults: `customerId` and `source` are **not** set, so they remain `null` (schema: `customerId String?`, `source BookingSource?`).

---

## C. Which Fields Are Preserved vs Lost

| Field           | In current booking select? | In new booking create data? | Result on new booking   |
|----------------|----------------------------|-----------------------------|--------------------------|
| userId         | Yes                        | Yes                         | Preserved                |
| serviceId      | Yes                        | Yes                         | Preserved                |
| locationId     | Yes                        | Yes (or from service)       | Preserved                |
| masterId       | N/A (new choice)           | Yes (newMasterId)           | Set                      |
| scheduledAt    | Yes                        | Yes (parsed new time)       | Preserved (new value)    |
| status         | Yes                        | Yes ("PENDING")             | Set                      |
| **customerId** | **No**                     | **No**                      | **Lost (null)**          |
| **source**     | **No**                     | **No**                      | **Lost (null)**          |

Other booking fields (e.g. `packageId`, reminder fields, `expiresAt`) are not copied either; the diagnostic focus is on CRM linkage, so `customerId` and `source` are the critical ones.

---

## D. Whether customerId Is Available Before Creation

- **Current booking is loaded** with (lines 197–207):

  ```ts
  const current = await prisma.booking.findFirst({
    where: { id: currentBookingId, userId: user.id },
    select: {
      id: true,
      userId: true,
      serviceId: true,
      locationId: true,
      status: true,
      scheduledAt: true,
    },
  })
  ```

- **`customerId` and `source` are not in `select`.** So they are **not** read from the DB. Even though the original row has `customerId` and `source` in the database, they are **not available in memory** in `current` when building the new booking.

So the bug has two parts:

1. The original booking is fetched **without** `customerId` and `source`.
2. The new booking is created with an explicit `data` object that **omits** `customerId` and `source`.

To fix, both must be addressed: include `customerId` and `source` in the select for `current`, and pass them through into `tx.booking.create` (when present).

---

## E. Telegram vs Admin Path Comparison

- **Telegram reschedule:** The only reschedule path found is the Telegram one: `POST /bookings/reschedule` → `rescheduleBookingByTelegramId`. This path creates the new booking without `customerId`/`source`, so the bug is in this path.
- **Admin reschedule:** No admin reschedule/move/transfer booking endpoint was found in the codebase. So the issue is **not** “admin vs Telegram”; it is that the **only** reschedule implementation (Telegram) does not copy CRM fields.
- **Initial Telegram booking:** In `backend/src/routes/telegramBookings.ts`, `createTelegramBookingHandler` uses `BookingService.createBooking(user.id, { customerId, source: customerId ? "BOT" : undefined })`. So when a booking is **first** created via the bot, `customerId` and `source` are set when available. Reschedule does not use this flow; it uses `rescheduleBookingByTelegramId`, which has its own create and does not pass these fields.

---

## F. Why Admin Panel Shows Fallback User Instead of Customer Link

- **Admin booking list** (e.g. in `backend/src/modules/admin/admin.routes.ts`, around 227–322): Bookings are loaded with `customerId: true` and `source: true`. For each booking, `customerIds` are collected and customers are fetched into `customerMap`. For each item:

  - `const customer = b.customerId ? customerMap[b.customerId] : null`
  - `client = customer ? { name: customer.name, ... } : user ? { name: user.name, ... } : null`

  So the UI uses **`booking.customerId`** to decide whether to show the CRM customer. If `customerId` is set, it uses `customerMap[b.customerId]` and the client is the Customer (clickable customer card). If `customerId` is null, it falls back to `user` (User record), which the front end can show as “Telegram User · TG:…”.

- **Conclusion:** The admin panel behaviour is a direct consequence of **missing customer linkage** on the new booking. When the rescheduled booking has `customerId = null`, `customer` is null and the code correctly falls back to the user. This is not a separate rendering bug; it follows from the backend not setting `customerId` on the new booking.

---

## G. Likely Side Effects on CRM / Customer History

- **Customer booking history:** In admin, `GET /customers/:id` (and similar) loads the customer with `customer.bookings`. That relation is driven by `Booking.customerId`. If the rescheduled booking is created with `customerId = null`, it will **not** appear in that customer’s booking list. So the “new” appointment is missing from the client’s card.
- **Customer profile booking list:** Same as above; any view that lists “bookings for this customer” via the `customerId` relation will omit the rescheduled booking.
- **Filters / search by customer:** Any report or filter that joins Booking to Customer via `customerId` will not count or show the rescheduled booking under the customer.
- **CRM navigation from booking to customer:** The admin row uses `customerId` to show the clickable customer link. No `customerId` ⇒ no customer link, only the Telegram user fallback.
- **Reporting:** Any aggregation or reporting that groups by customer or uses `booking.customerId` will treat the rescheduled booking as “no customer” unless fixed.

---

## H. Root Cause

**Exact code path that causes the new booking to lose `customerId` (and `source`):**

1. **File:** `backend/src/modules/booking/booking.service.ts`
2. **Function:** `rescheduleBookingByTelegramId`
3. **Two concrete causes:**
   - **Cause 1 (source of truth):** The original booking is fetched with a `select` that **does not include `customerId` or `source`** (lines 197–207). So they are never read.
   - **Cause 2 (create payload):** The new booking is created with a `data` object (lines 258–266) that **only** sets `userId`, `serviceId`, `locationId`, `masterId`, `scheduledAt`, `status`. **`customerId` and `source` are omitted**, so Prisma leaves them null.

So the rescheduled booking keeps User linkage (`userId`) but loses CRM linkage because: (a) the code never loads `customerId`/`source` from the original booking, and (b) it never passes them into the create. There is no separate DTO/mapper stripping the fields; the module simply never reads or writes them for reschedule.

---

## I. Minimal Safe Fix Direction

**Do not implement here; describe only.**

- **Where:** In **`backend/src/modules/booking/booking.service.ts`**, in **`rescheduleBookingByTelegramId`**.
- **What:**
  1. **Extend the `select`** for the current booking (the `prisma.booking.findFirst` around lines 197–207) to include `customerId` and `source`.
  2. **In the same function**, when calling `tx.booking.create`, add to the `data` object:
     - `customerId: current.customerId ?? undefined` (or equivalent so null in DB stays null in create),
     - `source: current.source ?? undefined`,
     so that the new booking is created with the same CRM linkage as the original when present.

- **Scope:** Only this function and this create call. No change to API contract, no new endpoints, no schema change. No change to other booking creation paths (e.g. initial Telegram booking or `BookingService.createBooking`) is required for this fix.
- **Safety:** If the original booking had no customer (e.g. legacy or created without phone), `customerId` and `source` will be null and the new booking will correctly have null as well. If the original had a customer and source, the new booking will retain them.

**End of report.**
