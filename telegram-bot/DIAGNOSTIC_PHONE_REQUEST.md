# Diagnostic Report: Phone Not Requested Before Booking Confirmation

**Scope:** Read-only production diagnostic. No code changes.

**Question:** Why, in the real tested booking flow, was the user able to proceed to booking creation without any phone request, even though no Customer existed and the intended design says phone should be requested?

---

## A. Tested Flow Reconstruction

From backend logs and code:

1. **Auth** — User authenticated (POST `/telegram/auth` implied by subsequent booking steps).
2. **Catalog / service / master / date / time** — Flow proceeded through catalog, service, master, then either date or a “nearest slot” step.
3. **No GET `/telegram/customers/check`** — This endpoint is called only from `checkCustomerHasPhone()` in `telegram-bot/src/api/backend.client.ts` (lines 114–125). Its absence in logs means that function was never executed in the tested path.
4. **Direct to confirm and create** — Logs show POST `/telegram/bookings`, then POST `/telegram/bookings/service`, `/master`, `/time`, i.e. user reached the confirm screen, pressed “Подтвердить запись”, and `onConfirmBooking` ran.

**Reconstructed path:** Entry (e.g. catalog or /book) → auth → category/service (catalog or direct) → master selection → **“⚡ Записаться на ближайшее”** (nearest slot) → confirm screen → confirm button → booking creation. No date grid, no time-slot grid, no phone check.

---

## B. Actual Time Slot → Next Step Logic

There are **two** distinct code paths from “slot chosen” to the confirm screen.

### Path 1: Explicit time-slot button (date → day → time grid)

- **Trigger:** User selects a **concrete time** from the grid (callback_data `t:${scheduledAtIso}`).
- **Handler:** `bot.callbackQuery(/^t:(.+)$/, ...)` in `telegram-bot/src/bot.ts` (lines 636–647) → `onTimeSlotChosen(ctx, ctx.match[1])`.
- **Logic in `onTimeSlotChosen`** (`telegram-bot/src/handlers/bookingFlow.ts`, 897–939):
  - Validates session (serviceId, masterId, dateStr).
  - Sets session (step `"confirm"`, timeStr, scheduledAtIso, confirm state).
  - If `session.rescheduleBookingId` → `showRescheduleConfirmScreen` and return.
  - **Calls `checkCustomerHasPhone(String(telegramId))`** (line 924).
  - If `hasPhone` → `showConfirmScreen` and return.
  - Else → `setBookingSession(telegramId, { awaitingContact: true })`, then sends `PHONE_REQUEST_MESSAGE` and keyboard with `Keyboard().requestContact("📱 Поделиться номером")`, then `answerCallbackQuery()`.

So after a **grid time slot** (`t:...`), the flow **does** run the phone check and either shows confirm or asks for contact.

### Path 2: “Записаться на ближайшее” (nearest slot)

- **Trigger:** User selects **“⚡ Записаться на ближайшее”** (callback_data `nearest:${scheduledAtIso}`).
- **Handler:** `bot.callbackQuery(/^nearest:(.+)$/, ...)` in `telegram-bot/src/bot.ts` (598–605) → `onNearestSlotChosen(ctx, ctx.match[1])`.
- **Logic in `onNearestSlotChosen`** (`telegram-bot/src/handlers/bookingFlow.ts`, 389–413):
  - Validates session (serviceId, masterId).
  - Sets session (dateStr, timeStr, scheduledAtIso, step `"confirm"`, confirm state).
  - If `session.rescheduleBookingId` → `showRescheduleConfirmScreen`.
  - **Else → directly `showConfirmScreen(ctx, telegramId, scheduledAtIso)`** (line 411).
  - **No call to `checkCustomerHasPhone`.**

So after **“nearest slot”**, the flow **never** checks phone and **never** requests contact; it goes straight to the confirm screen.

**Conclusion:** In the tested scenario, the user took Path 2 (nearest slot). That path does not execute any phone-check or contact-request step.

---

## C. Phone Check Integration

- **Definition:** `checkCustomerHasPhone(telegramId: string)` in `telegram-bot/src/api/backend.client.ts` (114–125). It performs `GET ${BACKEND_URL}/telegram/customers/check?telegramId=...` and returns `data.hasPhone === true`.
- **Call sites:** Only one: **`telegram-bot/src/handlers/bookingFlow.ts` line 924**, inside `onTimeSlotChosen`.
- **Is it executed on the tested path?** **No.** The tested path used the “nearest slot” button and therefore `onNearestSlotChosen`, which does not call `checkCustomerHasPhone`. So the phone check is present in the codebase but **not** on the path that was exercised.

---

## D. Reachability of Contact Request Code

- **Contact UI:** In `bookingFlow.ts` (929–933): `setBookingSession(telegramId, { awaitingContact: true })` and reply with `Keyboard().requestContact("📱 Поделиться номером")`. This block is reachable only from `onTimeSlotChosen` when `!hasPhone` (and not in reschedule branch).
- **Contact handler:** In `bot.ts` (842–862): `bot.on("message:contact", ...)` checks `session.awaitingContact` and required session fields (serviceId, masterId, dateStr, scheduledAtIso), then sets phone and calls `showConfirmScreen`. So the contact handler is registered and works when `awaitingContact` has been set.
- **In the tested (nearest-slot) path:** The flow never enters `onTimeSlotChosen` and never sets `awaitingContact`. The contact-request block is **not reachable** on that path; it is only reachable when the user goes through date → day → time grid and selects a slot (`t:...`). So for the observed flow, the contact request code is effectively **not used**.

---

## E. Path Comparison

| Path | Entry | After master | Slot chosen via | Handler | checkCustomerHasPhone? | Contact request possible? |
|------|--------|--------------|------------------|---------|------------------------|----------------------------|
| **Direct /book** | /book | Same `onMasterChosen` | Same two options below | — | — | — |
| **Catalog** | Catalog → service | Same `onMasterChosen` | Same two options below | — | — | — |
| **Nearest slot** | Any | `getNearestAvailableSlot` → show “nearest” screen | `nearest:ISO` | `onNearestSlotChosen` | **No** | **No** |
| **Choose date & time** | Any | No nearest or user chose “Выбрать дату и время” | `day:YYYY-MM-DD` → then `t:ISO` | `onTimeSlotChosen` | **Yes** | **Yes** (if !hasPhone) |
| **Reschedule** | Reschedule wizard | — | `t:ISO` or `nearest:ISO` | Same handlers | No (by design for reschedule) | No |

Catalog and direct booking share the same post-master logic: `onMasterChosen` in `bookingFlow.ts` (719–762). After master selection it always does:

- `const nearest = await getNearestAvailableSlot(serviceId, masterId)`
- If `nearest` → `showNearestSlotScreen` (options: “Записаться на ближайшее” and “Выбрать дату и время”).
- Else → `showDateSelection` (day buttons, then time grid).

So:

- **Direct flow** and **catalog flow** both can hit the **nearest-slot** screen when the master has availability. If the user clicks “Записаться на ближайшее”, **neither** flow runs the phone check.
- Only the **“Выбрать дату и время” → day → time slot** path uses `onTimeSlotChosen` and thus runs the phone check and can show the contact button.

There is no separate “electro” or catalog-specific time handler; the gap is purely that **nearest-slot** uses a different handler (`onNearestSlotChosen`) that bypasses the phone gate.

---

## F. Root Cause

**Primary root cause:** The **“nearest slot”** path (`onNearestSlotChosen`) never calls `checkCustomerHasPhone` and never requests contact. It goes straight from slot choice to `showConfirmScreen`. When the user took that path (as indicated by no GET `/telegram/customers/check` in logs and by the presence of booking creation), the phone-check step was skipped by design of that handler.

**Contributing factor:** After master selection, the UI prioritizes the “Записаться на ближайшее” option. So the **default, one-click path** from master to confirm is the one that skips the phone check; the path that enforces it requires an extra choice (“Выбрать дату и время”) and then day + time slot.

---

## G. Minimal Safe Fix Direction

**Do not implement here; description only.**

- **Where to enforce the phone check:** In the same place where the flow transitions from “slot chosen” to “show confirm screen”. That transition happens in two handlers:
  1. `onTimeSlotChosen` — already enforces phone check (and contact request when needed).
  2. `onNearestSlotChosen` — currently does not; it should be aligned with the same gate.

- **Minimal safe fix:** Before showing the confirm screen (or reschedule confirm) in `onNearestSlotChosen`, run the same logic as in `onTimeSlotChosen` after the reschedule branch: call `checkCustomerHasPhone(telegramId)`; if the customer has a phone, then call `showConfirmScreen` (or reschedule confirm); if not, set `awaitingContact: true`, send the same phone-request message and the same `requestContact` keyboard, and do **not** show the confirm screen until the user shares contact (contact handler already calls `showConfirmScreen` when contact is received). No new APIs or new UI are required; the contact handler and contact keyboard already exist. The change is limited to the control flow in `onNearestSlotChosen` so that it cannot reach the confirm screen without either a positive phone check or going through the existing contact-request flow.

---

**End of report.**
