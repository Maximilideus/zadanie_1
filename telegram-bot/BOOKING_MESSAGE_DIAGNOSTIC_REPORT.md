# Booking Message UX — Read-Only Diagnostic Report

**Scope:** Identify why Telegram booking messages show incorrect duplicated values for service / zone / duration. No code changes.

---

## A. Where service / zone / duration values come from

### Two distinct code paths

1. **Session path (wizard, confirm, nearest slot, reschedule “new” card)**  
   Used when the user is in the booking flow and the message is built from in-memory `BookingSession`.

2. **Backend path (booking list, cancel confirm, reschedule “old” card)**  
   Used when the message is built from `UpcomingBookingItem` returned by `getUpcomingBookings(telegramId)`.

---

### Session path — source of display values

| Display field | Source object/variable | Where computed | Passed into formatter | Rendered in |
|---------------|------------------------|----------------|------------------------|-------------|
| **📋 Услуга (procedure type)** | `procedureType` | `getProcedureTypeForSession(session.category, session.serviceName)` in `sessionToCardParts()` (bookingFlow.ts:231) | As `parts.serviceName` → `formatBookingCardFromParts` → `formatBookingBlock(parts.procedureType)` | `formatBookingBlock` (formatters.ts:155) |
| **📍 Зона** | `zone` | `session.catalogElectroZone ?? session.catalogTitle` in `sessionToCardParts()` (bookingFlow.ts:229) | `parts.zone` → same chain | `formatBookingBlock` (formatters.ts:156) |
| **⏱ Длительность** | `durationMin` | `session.durationMin` in `sessionToCardParts()` (bookingFlow.ts:234) | `parts.durationMin` | `formatBookingBlock` (formatters.ts:158) |

- **session.category** — Set when entering catalog (`onCategoryChosen`: `category: categoryEnum` e.g. `"LASER"`) or when starting wizard (`startWizardWithService` extra `category: session.category ?? item.category`). Comes from catalog API `item.category` (string, may be enum value).
- **session.serviceName** — Set in `startWizardWithService(..., serviceName, ...)`; callers pass `formatServiceDisplayName(item.service)` (e.g. `"Лазерная эпиляция — 20 мин"`). Also set in `onServiceChosen` from `formatServiceDisplayName(s)` (direct service list). In reschedule flow set from `formatServiceDisplayName(booking.service)`.
- **session.catalogTitle** — Set in catalog flow as `catalogTitle: item.titleRu` (e.g. `"Голени"`).
- **session.catalogElectroZone** — Set only in electro zone flow: `setBookingSession(..., { catalogElectroZone: item.titleRu })` in `onElectroZoneSelected`.

Session path does **not** use `booking.service.name` or `booking.service.zone`; it only uses session fields above.

---

### Backend path — source of display values

| Display field | Source object/variable | Where computed | Passed into formatter | Rendered in |
|---------------|------------------------|----------------|------------------------|-------------|
| **📋 Услуга (procedure type)** | `procedureType` | `formatServiceNameOnly(booking.service)` in `formatBookingCard()` (formatters.ts:171) using `booking.service.name` | `formatBookingCard` → `formatBookingBlock` | `formatBookingBlock` (formatters.ts:155) |
| **📍 Зона** | `zone` | `(booking.service as { zone?: string }).zone` in `formatBookingCard()` (formatters.ts:172). Value comes from API response `service.zone`. | Same | `formatBookingBlock` (formatters.ts:156) |
| **⏱ Длительность** | `durationMin` | `booking.service.durationMin` in `formatBookingCard()` (formatters.ts:173). From API `service.durationMin`. | Same | `formatBookingBlock` (formatters.ts:158) |

Backend builds `service` in `getUpcomingBookingsByTelegramId` (booking.service.ts:401–438):

- **service.name** — From `Service.name` in DB (e.g. `"Laser 20 min"`, `"Electro 60 min"`).
- **service.displayName** — `getServiceDisplayName(s.name)` (e.g. `"Лазерная эпиляция"`). **Not used** by the bot for the “Услуга” line; the bot uses `formatServiceNameOnly(service)` from `service.name`.
- **service.zone** — From `zoneByServiceId[b.serviceId]`: first catalog item (by `sortOrder`) for that `serviceId` gives `item.titleRu` (e.g. `"Голени"`). For electro time packages, if no catalog zone: `zone = \`${svc.durationMin} минут\`` (e.g. `"60 минут"`).
- **service.isElectroTimePackage** — `s.category === "ELECTRO" && s.groupKey === "time"` from `Service` in DB.

So for backend path, procedure type is derived only from `service.name`; zone and duration come from the API payload.

---

## B. Why LASER / WAX show duplicated service and zone

**Observed:**  
`📋 Услуга: Голени` and `📍 Зона: Голени`.

**Cause:** The line “📋 Услуга” is showing the **zone** label instead of the procedure type (“Лазерная эпиляция” / “Восковая депиляция”). That can happen in two ways.

### 1. Session path: procedure type falls back to something that strips to the zone name

In `sessionToCardParts`:

- `procedureType = getProcedureTypeForSession(session.category, session.serviceName)`.
- `zone = session.catalogElectroZone ?? session.catalogTitle` (often `item.titleRu`, e.g. `"Голени"`).

In `getProcedureTypeForSession` (formatters.ts:60–66):

- If `category === "MASSAGE"` and `serviceName` is set → use stripped `serviceName` (for subtype).
- Else if `category` is in `CATEGORY_TO_PROCEDURE` (e.g. `"LASER"`, `"WAX"`) → return that (e.g. `"Лазерная эпиляция"`).
- Else → `return stripTrailingDuration(serviceName ?? "—") || "—"`.

So if **category is missing or does not match** (e.g. API returns `"laser"` and keys are `"LASER"`), the code falls back to `stripTrailingDuration(session.serviceName)`. If at any point **session.serviceName** is set to the zone or to a string that strips to the zone (e.g. `"Голени"` or `"Голени — 25 мин"`), then **procedureType becomes "Голени"** and zone is also `catalogTitle` = `"Голени"` → duplication.

Concrete causes on session path:

- **Category mismatch:** `item.category` or `session.category` is lowercase or different from `"LASER"` / `"WAX"`, so `CATEGORY_TO_PROCEDURE[category]` is undefined and the fallback uses `session.serviceName`.
- **Wrong value in session.serviceName:** If any code path ever set `session.serviceName` to `item.titleRu` or to a display string that strips to the zone name, procedure type would show the zone.

Current callers of `startWizardWithService` pass `formatServiceDisplayName(item.service)` (or equivalent), which uses `item.service.name` (DB service name like `"Laser 20 min"`), so under current code `session.serviceName` should not be the zone **unless** the catalog API returns `item.service.name` as the zone (e.g. bad data or different backend shape).

### 2. Backend path: service.name is the zone name

In `formatBookingCard` the procedure type is **always** `formatServiceNameOnly(booking.service)`, which uses **only** `booking.service.name`. It does **not** use `displayName`.

So for the backend path, duplication happens only if the API sends **service.name** such that `formatServiceNameOnly` returns the zone. That occurs when `service.name` does **not** start with `Waxing`/`Laser`/`Electro`/`Massage` and after stripping `\s+\d+\s*min` the remainder is the zone (e.g. `"Голени"`). So:

- If the backend ever returns `service.name === "Голени"` (or similar), the bot would show “Услуга: Голени” and “Зона: Голени”.
- That would mean either the `Service` row in the DB has `name` set to the zone, or another response path builds `service.name` from catalog title.

**Exact code path for duplication (session path):**

1. User selects zone (e.g. “Голени”) in catalog → `onCatalogItemChosen` or equivalent.
2. `startWizardWithService(..., formatServiceDisplayName(item.service), { ..., category: session.category ?? item.category, catalogTitle: item.titleRu })`.
3. Session ends up with `catalogTitle = "Голени"`, and either:
   - `category` missing or not in `CATEGORY_TO_PROCEDURE`, and `serviceName` such that `stripTrailingDuration(serviceName)` is `"Голени"`, or
   - `serviceName` set elsewhere to zone or zone-like string.
4. `sessionToCardParts` → `procedureType = getProcedureTypeForSession(session.category, session.serviceName)` → `"Голени"`; `zone = session.catalogTitle` → `"Голени"`.
5. `formatBookingCardFromParts` / `formatBookingBlock` → “📋 Услуга: Голени” and “📍 Зона: Голени”.

**Exact code path for duplication (backend path):**

1. `getUpcomingBookings` returns `service: { name: "Голени" (or zone-like), zone: "Голени", ... }`.
2. `formatBookingCard(booking)` → `procedureType = formatServiceNameOnly(booking.service)` → `"Голени"`; `zone = booking.service.zone` → `"Голени"`.
3. Same render → “📋 Услуга: Голени” and “📍 Зона: Голени”.

---

## C. Why ELECTRO shows duplicated zone and duration

**Observed:**  
`📋 Услуга: Электроэпиляция`, `📍 Зона: 60 минут`, `⏱ Длительность: 60 мин`.

**Expected:** For an electro **time package**, no zone line; show procedure + duration (and optionally “Пакет времени” with duration label, not “Зона”).

**Cause:** The backend sends a **zone** value that is the duration label (“60 минут”), and the formatter treats the booking as **zone-based** (shows “Услуга” + “Зона”) instead of time-package (only “Пакет времени” or no zone line).

### Where “60 минут” comes from

In `getUpcomingBookingsByTelegramId` (booking.service.ts:420–424):

- `zone` is first set from `zoneByServiceId[b.serviceId]` (catalog `titleRu`).
- If `svc?.isElectroTimePackage && !zone && svc.durationMin != null`, then **`zone = \`${svc.durationMin} минут\``** (e.g. `"60 минут"`).

So for electro time packages **without** a catalog zone, the backend **intentionally** sets `service.zone` to the duration text. The API then returns e.g.:

- `service.zone = "60 минут"`
- `service.isElectroTimePackage = true` (when `Service.category === "ELECTRO"` and `Service.groupKey === "time"`).

### How the formatter uses it

In `formatBookingBlock` (formatters.ts:152–157):

- If `parts.isElectroTimePackage && parts.zone` → show **only** `🗂 Пакет времени: ${parts.zone}` (no “Услуга” / “Зона” lines).
- Else → show `📋 Услуга: ${parts.procedureType}` and, if `parts.zone`, `📍 Зона: ${parts.zone}`.

So when **isElectroTimePackage** is **true** and zone is set, the user should see “Пакет времени: 60 минут” and **no** “Зона” line. The observed output (“Услуга: Электроэпиляция” + “Зона: 60 минут”) is the **else** branch, so **isElectroTimePackage** must be **false** (or missing) when the message is built.

### Why isElectroTimePackage can be false

1. **Service row in DB:** `Service.category` or `Service.groupKey` is null or not `"time"` for that electro time service (e.g. migration not backfilled). Then in the backend, `isElectroTimePackage = s.category === "ELECTRO" && s.groupKey === "time"` is false, so the API never sends `isElectroTimePackage: true`.
2. **API/type stripping:** The bot’s `UpcomingBookingItem` includes `isElectroTimePackage?: boolean`; if the backend omits it or the client drops it, it becomes `undefined` and the formatter’s `if (parts.isElectroTimePackage && parts.zone)` fails.

So the duplication is:

- Backend sends **zone = "60 минут"** (duration label) for electro time packages (with or without catalog zone).
- When **isElectroTimePackage** is not true at formatter input, the formatter uses the zone-based branch and shows both “Услуга: Электроэпиляция” and “Зона: 60 минут”.
- Duration is also shown from `durationMin` → “60 мин”, so “60 минут” appears both as zone and as duration.

**Exact code path:**

1. Backend: `zone = "60 минут"` (from duration fallback or catalog); `isElectroTimePackage` false or missing (e.g. Service missing category/groupKey).
2. Bot: `formatBookingCard(booking)` → `isElectroTimePackage = booking.service.isElectroTimePackage` falsy.
3. `formatBookingBlock` takes the else branch → “📋 Услуга: Электроэпиляция”, “📍 Зона: 60 минут”, “⏱ Длительность: 60 мин”.

---

## D. Helper-by-helper assumptions and where they break

| Helper | Inputs | Assumptions | Where it breaks |
|--------|--------|-------------|------------------|
| **formatServiceNameOnly(service)** | `ServiceLike` with `name` | `name` is internal DB name (e.g. "Laser 20 min", "Electro 60 min"). | If `name` is zone or arbitrary text (e.g. "Голени"), returns that as “procedure type” → wrong service line. |
| **getProcedureTypeForSession(category, serviceName)** | Session category (e.g. "LASER") and display service name. | Category is exact key in `CATEGORY_TO_PROCEDURE` (e.g. "LASER"). For non-MASSAGE, procedure type comes from category. | If category is missing or different (e.g. "laser"), falls back to `stripTrailingDuration(serviceName)`; if that is zone → procedure type becomes zone. |
| **stripTrailingDuration(s)** | Display string. | Only strips “ — N мин” (Cyrillic “мин”). | If string is "Голени" or "Голени — 25 мин", result is "Голени" → unsafe as procedure type when used as fallback. |
| **sessionToCardParts(session)** | Full `BookingSession`. | `session.category` is set and matches `CATEGORY_TO_PROCEDURE`. `session.serviceName` is procedure + duration, not zone. `session.catalogTitle` / `catalogElectroZone` are zone only. | If category not set or wrong, or serviceName overwritten with zone → procedureType becomes zone; with zone from catalogTitle → duplication. |
| **formatBookingCard(booking)** | `BookingCardInput` with `service` from API. | `service.name` is internal name (Laser/Electro/…). `service.zone` is body zone or empty for time packages. `service.isElectroTimePackage` is set for electro time packages. | If backend sends `name` = zone or `isElectroTimePackage` missing/false while zone = "60 минут" → wrong service line or zone/duration duplication. |
| **formatBookingBlock(parts)** | `BookingBlockParts` with procedureType, zone, isElectroTimePackage, etc. | For electro time packages, `isElectroTimePackage && zone` → show only “Пакет времени”, no “Зона”. Otherwise zone is a body zone. | If `isElectroTimePackage` is false but zone is a duration label (“60 минут”), formatter still shows “Зона” → duplication with duration line. |
| **formatCatalogIntro(item)** | `CatalogItemResponse` (category, titleRu, durationMin, price, groupKey). | `item.category` is e.g. "ELECTRO"; `item.groupKey === "time"` identifies electro time. | If category/groupKey wrong or missing, intro can show zone where it shouldn’t (e.g. electro time). |

---

## E. Whether enough data already exists for correct rendering

### LASER / WAX (zone-based)

- **Session path:** We have `session.category` (e.g. "LASER"/"WAX") and `session.serviceName` (from `formatServiceDisplayName(item.service)`). So we **do** have enough: procedure type should come from category (or from `item.service.name` if we used it). Risk: category string mismatch (e.g. "laser" vs "LASER") or wrong serviceName.
- **Backend path:** We have `service.name` (e.g. "Laser 20 min"), `service.zone` (catalog titleRu, e.g. "Голени"), `service.displayName`. So we **do** have enough: procedure type from `service.name` via `formatServiceNameOnly`, zone from `service.zone`. Risk: DB `Service.name` set to zone for some rows.

**Conclusion:** Data is sufficient. Correct behaviour: use **procedure type** from category (session) or from `service.name` (backend); use **zone** only from catalog/API zone field; never show zone as the “Услуга” line.

### ELECTRO time package

- **Backend:** We have `service.isElectroTimePackage`, `service.zone` (set to “60 минут” by backend when no catalog zone), `service.durationMin`. So we **do** have enough **if** `isElectroTimePackage` is true: then formatter should show “Пакет времени” and not “Зона”. When `isElectroTimePackage` is false (e.g. Service not marked in DB), we still have `service.name` and `service.durationMin`, but zone is wrong (duration label), so we must either not show zone for time packages or fix backend to not send zone as “60 минут” when it’s a time package.

**Conclusion:** Data is sufficient **if** backend sets `isElectroTimePackage` correctly and formatter uses it. If not, we need either: (1) backend to set `category`/`groupKey` on electro time services and keep sending `isElectroTimePackage`, and/or (2) bot to treat “zone” that looks like a duration (e.g. “N минут”) as non-zone when we know it’s electro time (e.g. from `service.name` starting with "Electro").

---

## F. Exact display rules per category

Based on current code and data model:

**LASER (zone-based):**

- **service line** = `"Лазерная эпиляция"` (from category or from `formatServiceNameOnly(service)` where `service.name` e.g. "Laser 20 min").
- **zone line** = catalog/API zone (e.g. "Голени"). Shown when zone is present and not a time-package label.
- **duration line** = `durationMin` when available (e.g. "20 мин").

**WAX (zone-based):**

- **service line** = `"Восковая депиляция"` (from category or from `service.name` e.g. "Waxing 25 min").
- **zone line** = catalog/API zone (e.g. "Голени").
- **duration line** = `durationMin` when available.

**ELECTRO time package (groupKey "time", no body zone):**

- **service line** = `"Электроэпиляция"` (or omit if showing “Пакет времени” only).
- **zone line** = **omit**. Do not show “📍 Зона” for time packages; backend should not send a zone that is just the duration label, or formatter should ignore it when `isElectroTimePackage` is true.
- **duration line** = `durationMin` (e.g. "60 мин"). Optionally show “🗂 Пакет времени: 60 мин” (or “60 минут”) instead of Услуга+Зона.

**ELECTRO zone-based (body/face):**

- **service line** = `"Электроэпиляция"`.
- **zone line** = catalog zone (e.g. "Голени").
- **duration line** = when available.

**MASSAGE:**

- **service line** = subtype from session/API (e.g. "Релакс-массаж") or “Массаж”.
- **zone line** = only if there is a real body zone (if applicable in product).
- **duration line** = when available.

---

## G. Minimal safe fix strategy

1. **Session path — avoid zone as procedure type**
   - Normalize `session.category` to uppercase before calling `getProcedureTypeForSession` (e.g. `category?.toUpperCase()`), so "laser" matches `CATEGORY_TO_PROCEDURE["LASER"]`.
   - Ensure no code path ever assigns `session.serviceName` to `item.titleRu` or to a string that strips to the zone; keep using `formatServiceDisplayName(item.service)` (or procedure type from category).

2. **Backend path — keep procedure type from name**
   - Keep using `formatServiceNameOnly(booking.service)` for the “Услуга” line (do not use `displayName` for that line).
   - Ensure backend never returns `service.name` equal to a zone; keep `Service.name` as internal name (e.g. "Laser 20 min"). If any legacy rows have zone as name, fix data or add a fallback (e.g. by category) in the backend when building the response.

3. **ELECTRO time package**
   - **Backend:** Ensure all electro time services have `Service.category = "ELECTRO"` and `Service.groupKey = "time"` so `isElectroTimePackage` is true. Optionally, for time packages do **not** set `zone = "60 минут"`; leave zone undefined so the bot does not show a zone line.
   - **Bot:** When `isElectroTimePackage` is true, keep current behaviour: show only “Пакет времени” and no “Зона” line. If `isElectroTimePackage` is missing but `service.name` starts with "Electro" and `service.zone` looks like “N минут”, treat as time package and suppress or replace the zone line (e.g. show “Пакет времени” instead of “Зона”) so “60 минут” is not duplicated as zone and duration.

4. **Formatters**
   - No change to `formatServiceNameOnly` logic; keep deriving procedure type from `name` prefix (Waxing/Laser/Electro/Massage).
   - In `getProcedureTypeForSession`, normalize category to uppercase before lookup.
   - In `formatBookingBlock`, keep the rule: when `isElectroTimePackage && zone`, show only “Пакет времени”; do not show “Зона” for time packages.

5. **Data**
   - Audit `Service` rows for LASER/WAX: ensure `name` is always like "Laser N min" / "Waxing N min", not zone titles.
   - Audit ELECTRO time services: ensure `category` and `groupKey` are set so `isElectroTimePackage` is true in API responses.

This report is diagnostic only; no code or formatting has been changed.
