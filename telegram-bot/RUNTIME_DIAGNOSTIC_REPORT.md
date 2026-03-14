# Runtime Diagnostic Report — "120 минут" on Услуга/Зона (Read-Only)

**Goal:** Determine why Telegram still shows incorrect ELECTRO text (e.g. "📋 Услуга: 120 минут", "📍 Зона: 120 минут", "⏱ Длительность: 120 мин") despite formatter fixes. No business logic or refactor changes; minimal logging only if needed, clearly marked temporary.

---

## A. Exact bot runtime / start path

**package.json (telegram-bot):**

- **`"dev"`:** `"tsx src/bot.ts"` (second `dev` key overwrites first; first was `tsx watch src/bot.ts`).
- **`"start"`:** `"node --experimental-vm-modules node_modules/tsx/dist/cli.mjs src/bot.ts"`.
- **`"build"`:** `"tsc"` (emits to `dist/` per tsconfig).

**tsconfig.json:**

- `outDir: "dist"`, `rootDir: "src"` → `npm run build` compiles `src/**/*` to `dist/`.

**How the bot is actually run:**

- **Normal development/production start:** `npm run dev` or `npm run start` both execute **`src/bot.ts`** via **tsx** (TypeScript run directly). There is no `npm run start` script that runs `dist/bot.js`.
- **No nodemon/pm2** config found in the repo; no process manager config inspected.

**Conclusion:**

- **Exact bot start command:** `tsx src/bot.ts` (dev) or `node ... tsx ... src/bot.ts` (start). In both cases the **entry is source**, not `dist/`.
- **Stale dist build:** Possible only if someone runs **`node dist/bot.js`** (or similar) manually or via a script not in the repo. The standard scripts do **not** run `dist/`.
- **Changing src:** For the standard scripts, changing `src/` is enough; tsx runs the updated source. **Rebuild is not required** for dev/start unless the run command is changed to use `dist/`.

---

## B. Whether stale build / process is plausible

- **Stale dist:** Plausible only if the running process was started with `node dist/bot.js` (or an old `dist/` copy). The in-repo scripts do not use `dist/`.
- **Stale process:** **Very plausible.** If the bot was started before the formatter fix and never restarted, it is still running old in-memory code. Restarting the process (e.g. stop and run `npm run dev` again) is required to load the updated formatter.
- **Recommendation:** Restart the bot process after any formatter change and ensure no separate start command uses `dist/` unless intended.

---

## C. Exact formatter chain for the bad message surfaces

All of the following surfaces use **backend data** (upcoming bookings API) and the same formatter chain.

| Surface | Entry | Chain |
|--------|--------|--------|
| **/my_bookings list** | bot.ts → callback "main_bookings" / "my_bookings" command | `getUpcomingBookings(telegramId)` → `buildBookingListMessage(bookings)` → for each booking `formatBookingCard({ service: b.service, masterName: b.masterName, scheduledAt: b.scheduledAt })` → `formatBookingBlock(...)` |
| **Reschedule start** | bookingFlow.ts → `startRescheduleWizard` | `formatBookingCard({ service: booking.service, masterName, scheduledAt })` (for "Перенос записи.\n\n" + card + "\n\nВыберите мастера:"). Same for "no masters" variant. |
| **Reschedule old card (confirm screen)** | bookingFlow.ts → `buildRescheduleConfirmText` | `session.rescheduleOldSummary` (set once in `startRescheduleWizard` = `formatBookingCard(booking)`) → so again `formatBookingCard` → `formatBookingBlock`. |
| **Reschedule success** | bookingFlow.ts → `onConfirmReschedule` | Uses **session path**: `formatBookingCardFromParts(sessionToCardParts(session), ...)` → `formatBookingBlock`. Not backend payload. |
| **Cancel confirmation** | bot.ts → callback `cancel_bk:${id}` | `getUpcomingBookings(telegramId)` → find booking → `formatBookingCard({ service: booking.service, ... })` → `formatBookingBlock`. |
| **Cancel too-late** | bot.ts → callback `cancel_bk_yes:${id}` (CANCELLATION_TOO_LATE) | Same: `getUpcomingBookings` → find booking → `formatBookingCard(booking)` → `formatBookingBlock`. |
| **Reschedule too-late** | bookingFlow.ts → `onConfirmReschedule` (RESCHEDULE_TOO_LATE) | `getUpcomingBookings(tid)` → find booking → `formatBookingCard(booking)` → `formatBookingBlock`. |

**Summary:** For the **bad output** that shows "120 минут" on Услуга and Зона, the only path that uses **backend payload** for that card is **`formatBookingCard(booking)`** → **`formatBookingBlock`**. So the exact runtime chain for the visible bad messages (list, reschedule start, reschedule old card, cancel confirm, cancel/reschedule too-late) is:

`getUpcomingBookings` → **formatBookingCard** → formatBookingBlock.

(Reschedule **success** message uses session data and `formatBookingCardFromParts(sessionToCardParts(session))`; if the bad text appears there too, that would point to session path, but the reported case is ELECTRO with "120 минут", which is typical of backend-sent zone/duration label.)

---

## D. Backend payload fields that drive the bad output

**API used:**

- **Endpoint:** `GET ${BACKEND_URL}/bookings/user/:telegramId/upcoming`
- **Bot type:** `UpcomingBookingItem[]` (backend.client.ts). One item: `{ id, status, scheduledAt, serviceId?, service: { name, displayName?, zone?, durationMin?, isElectroTimePackage? }, masterName }`.
- **No `service.category`** in the bot type or in the backend response (backend does not send category in the payload; it only uses it to compute `isElectroTimePackage`).

**What the formatter uses (formatBookingCard):**

| Field | Used? | How |
|-------|--------|-----|
| `booking.service.name` | **Yes** | `formatServiceNameOnly(booking.service)` → procedure type; `rawName.toLowerCase().startsWith("electro")` → isElectro. |
| `booking.service.zone` | **Yes** | Only when not electro: `zone = isElectro ? undefined : booking.service.zone`. |
| `booking.service.durationMin` | **Yes** | Passed to `formatBookingBlock` as `durationMin`. |
| `booking.service.isElectroTimePackage` | **No** | Not read; ELECTRO is inferred from `service.name` prefix "electro". |
| `booking.service.displayName` | **No** | Not used for the card. |
| `booking.service.category` | **N/A** | Not in API type; backend does not send it. |

**Backend behavior (booking.service.ts getUpcomingBookingsByTelegramId):**

- `service.name` = **Prisma `Service.name`** (DB).
- `service.zone` = from catalog (first catalog item by sortOrder) `titleRu`, or for **electro time packages** when no catalog zone: **`\`${svc.durationMin} минут\``** (e.g. `"120 минут"`).
- So for an ELECTRO time package with duration 120, the API can send **`service.name`** = DB value (e.g. `"Electro 120 min"`) and **`service.zone`** = `"120 минут"`.

**Conclusion:** The bad output "📋 Услуга: 120 минут" and "📍 Зона: 120 минут" can only occur if the **payload** the bot receives has:

- **procedure type "120 минут":** So **`service.name`** must be something that `formatServiceNameOnly` turns into `"120 минут"`. That happens when `service.name` does **not** start with Waxing/Laser/Electro/Massage and after stripping `\s+\d+\s*min\s*$` the remainder is empty or the raw string has no "min", so the function returns the raw string (e.g. **`service.name === "120 минут"`**).
- **zone "120 минут":** So **`service.zone`** = `"120 минут"` and **`isElectro`** is false. `isElectro` is false only when **`service.name`** does **not** start with `"electro"`. So again: **`service.name`** must not start with "electro" (e.g. it is `"120 минут"` or similar).

So the backend payload that drives the bad output is: **`service.name`** = `"120 минут"` (or another non-"Electro" string that becomes "120 минут"), and **`service.zone`** = `"120 минут"`. That implies the **backend** is sending a **wrong `service.name`** (e.g. the `Service` row in the DB has `name = "120 минут"` instead of `"Electro 120 min"`), or another code path builds the response with a different `name`.

---

## E. Can current code still produce the bad output?

**Yes.** Under this **exact** runtime input:

- **`booking.service.name`** = **`"120 минут"`** (or any string that does not start with "Waxing"/"Laser"/"Electro"/"Massage" and that yields "120 минут" from `formatServiceNameOnly`; e.g. raw `"120 минут"`).
- **`booking.service.zone`** = **`"120 минут"`** (or same value).
- **`booking.service.durationMin`** = **120**.

**Why:**

1. **`formatServiceNameOnly(service)`** with `name === "120 минут"` does not match any prefix; `withoutMin = raw.replace(/\s+\d+\s*min\s*$/i, "").trim()` leaves `"120 минут"` (no "min" at end); returns **`"120 минут"`** → **procedureType = "120 минут"**.
2. **`isElectro`** = `rawName.toLowerCase().startsWith("electro")` = **false**.
3. **`zone`** = `booking.service.zone` = **`"120 минут"`** (not cleared).
4. **`suppressZone`** = false.
5. **`formatBookingBlock`** then outputs "📋 Услуга: 120 минут", "📍 Зона: 120 минут", "⏱ Длительность: 120 мин".

So the **current formatter code** can still produce the bad output **if and only if** the backend (or whatever supplies the booking object) sends **`service.name`** that is not the internal pattern (e.g. not "Electro 120 min"). If `service.name` were `"Electro 120 min"`, then procedureType would be "Электроэпиляция", isElectro true, zone suppressed, and the bad lines would not appear.

**Conclusion:** The bug is **not** that the formatter logic is missing; it is that the **runtime input** to the formatter has **wrong `service.name`**. So either: (1) **backend/DB** is returning a `Service.name` like "120 минут", or (2) an **old bot process** (pre-fix) is still running and the fix is not in memory.

---

## F. Best next verification step

Recommended **single** place for a **temporary** diagnostic log (do not implement unless needed):

- **File:** `telegram-bot/src/services/formatters.ts`
- **Function:** `formatBookingCard`
- **Place:** Immediately after computing `procedureType`, `isElectro`, and `zone` (i.e. after the line that sets `zone = isElectro ? undefined : ...`), before `return formatBookingBlock(...)`.

**Log exactly once per card**, with:

- `booking.service.name`
- `booking.service.zone`
- `booking.service.durationMin`
- `(booking.service as { isElectroTimePackage?: boolean }).isElectroTimePackage`
- **Derived:** `procedureType`, `isElectro`, `zone` (value passed to block), `suppressZone`

**Note:** `formatBookingCard` does not receive `booking.id` in its current type; if you need to correlate with a specific booking, add a temporary optional `bookingId?: string` to the caller and pass it in, or log from the caller (e.g. in `buildBookingListMessage` or in the cancel/reschedule callbacks) with `b.id` and the same service fields. Prefer one log inside `formatBookingCard` so all call paths (list, cancel, reschedule) are covered.

**Suggested log line (temporary, remove after diagnosis):**

```ts
// TEMPORARY DIAGNOSTIC — remove after confirming formatter input
console.log("[formatBookingCard]", {
  serviceName: booking.service.name,
  serviceZone: (booking.service as { zone?: string }).zone,
  durationMin: booking.service.durationMin,
  isElectroTimePackage: (booking.service as { isElectroTimePackage?: boolean }).isElectroTimePackage,
  procedureType,
  isElectro,
  zonePassedToBlock: zone,
  suppressZone,
})
```

**Next steps in order:**

1. **Restart the bot** so the current formatter code is loaded (no dist run). Reproduce; if the bad text disappears, the cause was a stale process.
2. If the bad text **persists**, add the **temporary log** above in `formatBookingCard`, reproduce, and inspect logs. If you see `serviceName: "120 минут"` (or similar), the cause is **backend payload / DB** (`Service.name` wrong).
3. **Inspect backend payload / DB:** For the affected booking, check `Service.name` for the booking’s `serviceId` (e.g. in DB or by logging the upcoming-bookings API response). If it is "120 минут" or a duration-only label, fix the data or the backend so `name` is the internal pattern (e.g. "Electro 120 min"). No formatter change needed.

---

## Summary table

| Question | Answer |
|----------|--------|
| **Exact bot start** | `tsx src/bot.ts` or `node ... tsx ... src/bot.ts`; runs from **src**, not dist. |
| **Stale build plausible?** | Only if something runs `node dist/bot.js`. Stale **process** (old code in memory) is plausible. |
| **Formatter chain for bad surfaces** | `getUpcomingBookings` → **formatBookingCard** → formatBookingBlock. |
| **Payload fields that drive bad output** | **service.name** (procedure + isElectro); **service.zone** (zone line when isElectro false). Bot does not use displayName, isElectroTimePackage, or category. |
| **Can current code produce bad output?** | **Yes**, when **service.name** is not "Electro..." (e.g. "120 минут"). Then procedureType and zone both show "120 минут". |
| **Best next step** | 1) Restart bot and retest. 2) If still bad, add temporary log in `formatBookingCard` and check `service.name`. 3) If name is wrong, fix backend/DB so `Service.name` is internal pattern (e.g. "Electro 120 min"). |

---

*This report is diagnostic only. No business logic or message design was changed.*
