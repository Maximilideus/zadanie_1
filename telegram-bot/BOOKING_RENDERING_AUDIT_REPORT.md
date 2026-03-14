# Telegram Booking Message Rendering — Full Audit Report (Read-Only)

**Scope:** Complete audit of booking message rendering across all categories and all message surfaces. No code changes.

---

## A. All booking message rendering entry points

| File | Function | Message purpose | Shared formatter? | Formatter / helper used |
|------|----------|-----------------|-------------------|--------------------------|
| **bot.ts** | (inline in callback) | Deep-link start: intro + "Выберите мастера" | Yes | `formatCatalogIntro(result.item)` → intro block; `startWizardWithService(..., introText, ...)` sends intro + "Выберите мастера:" |
| **bot.ts** | `buildBookingListMessage` | /my_bookings list + each booking card | Yes | `formatBookingCard({ service: b.service, masterName, scheduledAt })` per booking |
| **bot.ts** | (inline in callback) | Cancel confirm: "Отменить эту запись?" + card | Yes | `formatBookingCard({ service: booking.service, ... })` |
| **bot.ts** | (inline in callback) | Cancel too-late: message + card | Yes | `formatBookingCard({ service: booking.service, ... })` |
| **bot.ts** | (inline in callback) | cancel_bk_no: back to list | Yes | `buildBookingListMessage(bookings)` → `formatBookingCard` per item |
| **bookingFlow.ts** | `showTimeSlotScreen` | Time slot grid (empty slots) | Yes | `buildSummary(session)` + header + empty message |
| **bookingFlow.ts** | `showTimeSlotScreen` | Time slot grid (with slots) | Yes | `buildSummary(session)` + header |
| **bookingFlow.ts** | `showNearestSlotScreen` | Nearest-slot choice screen | Yes | `formatBookingCardFromParts({ ...sessionToCardParts(session), date, time })` + trailing text |
| **bookingFlow.ts** | `showDateSelection` | Date selection screen | Yes | `buildSummary(session)` + "Выберите дату:" |
| **bookingFlow.ts** | `startWizardWithService` | Master selection (no masters) | Yes | `introText` (from caller) + "Нет доступных мастеров..." |
| **bookingFlow.ts** | `startWizardWithService` | Master selection (with masters) | Yes | `introText` + "Выберите мастера:" |
| **bookingFlow.ts** | `startRescheduleWizard` | Reschedule: old summary stored | Yes | `rescheduleOldSummary = formatBookingCard({ service: booking.service, ... })` |
| **bookingFlow.ts** | `startRescheduleWizard` | Reschedule start (no masters) | Yes | "Перенос записи.\n\n" + `formatBookingCard(booking)` + "\n\nНет доступных мастеров..." |
| **bookingFlow.ts** | `startRescheduleWizard` | Reschedule start (with masters) | Yes | "Перенос записи.\n\n" + `formatBookingCard(booking)` + "\n\nВыберите мастера:" |
| **bookingFlow.ts** | `startWizard` | Service list (wizard) | Yes | `buildSummary(session)` + "Выберите услугу:" |
| **bookingFlow.ts** | `showServiceList` | Service list (no services) | Yes | `buildSummary(session)` + "Нет доступных услуг." |
| **bookingFlow.ts** | `onMasterChosen` (no masters) | After master choice, no masters | Yes | `buildSummary(session)` + "Нет доступных мастеров для этой услуги." |
| **bookingFlow.ts** | `onMasterChosen` (with masters) | Master selection screen | Yes | `buildSummary(session)` + "Выберите мастера:" |
| **bookingFlow.ts** | `onMasterChosen` (master unavailable) | Master unavailable | Yes | `buildSummary(session)` + "Этот специалист сейчас недоступен. Выберите мастера:" |
| **bookingFlow.ts** | `onDayChosen` (no slots) | No slots on date | Yes | `buildSummary(session)` + NO_SLOTS_ON_DATE_MESSAGE |
| **bookingFlow.ts** | `onDayChosen` (with slots) | Time slot screen | Yes | `buildSummary(session)` + header + slots |
| **bookingFlow.ts** | `onTimeSlotChosen` (no slots) | No slots in period | Yes | `buildSummary(session)` + header + empty message |
| **bookingFlow.ts** | `onTimeSlotChosen` (with slots) | Time slot grid | Yes | `buildSummary(session)` + header |
| **bookingFlow.ts** | `onTimeFilterChosen` (empty) | Time filter, no slots | Yes | `buildSummary(session)` + header + empty message |
| **bookingFlow.ts** | `onTimeFilterChosen` (with slots) | Time filter, with slots | Yes | `buildSummary(session)` + header |
| **bookingFlow.ts** | `buildConfirmText` | Confirmation screen | Yes | `sessionToCardParts(session)` then `formatBookingBlock(parts)` (with price) or `formatBookingCardFromParts(parts)` |
| **bookingFlow.ts** | `showRescheduleConfirmScreen` | Reschedule confirm screen | Yes | `buildRescheduleConfirmText(session)` → "Текущая запись:\n" + `rescheduleOldSummary` + "Новая запись:\n" + `formatBookingCardFromParts(sessionToCardParts(session))` |
| **bookingFlow.ts** | `showConfirmScreen` / `sendConfirmScreenAsNewMessage` | Confirm screen shown | Yes | `buildConfirmText(session)` |
| **bookingFlow.ts** | `onConfirmBooking` (success) | Booking created success | Yes | "✅ Запись создана\n\n" + `formatBookingCardFromParts({ ...sessionToCardParts(session), date, time })` + "\n\nОжидает подтверждения..." |
| **bookingFlow.ts** | `onConfirmReschedule` (success) | Reschedule success | Yes | "✅ Запись перенесена\n\n" + `formatBookingCardFromParts({ ...sessionToCardParts(session), ... })` + "\n\nОжидает подтверждения..." |
| **bookingFlow.ts** | `onConfirmReschedule` (RESCHEDULE_TOO_LATE) | Reschedule too-late message | Yes | Card = `formatBookingCard(booking)` (from API) + trailing text |
| **bookingFlow.ts** | (various) | Date selection, no masters, manual date, etc. | Yes | `buildSummary(session)` + context message |
| **bookingFlow.ts** | `handleBackendError` (slot unavailable) | Time selection with message | Yes | `buildSummary(session)` + "\n\n" + text or `buildSummary(session)` + "\n\n" + text |
| **catalogFlow.ts** | `onCatalogItemChosen` | Catalog item → wizard intro | Yes | `introText = formatCatalogIntro(item)` or "Зона изменена..."; then `startWizardWithService(..., introText, ...)` |
| **catalogFlow.ts** | `onElectroZoneSelected` | Electro zone → wizard intro | Yes | `introText = formatCatalogIntro(item)`; then `startWizardWithService(..., introText, ...)` |
| **deeplink.ts** | `formatCatalogIntro` | "Вы выбрали" block (no booking block) | Yes (itself) | Builds lines: 📋 procedure, 📍 zone (if not ELECTRO), ⏱ duration, 💳 price. Uses `normalizeCategory(item.category)`. |

**Summary:** All booking-card or booking-block text goes through one of: `formatBookingCard`, `formatBookingCardFromParts` (→ `formatBookingBlock`), or `buildSummary` (→ `sessionToCardParts` → `formatBookingCardFromParts`). Catalog/deeplink intros use `formatCatalogIntro`. There are no separate ad-hoc builders for "📋 Услуга" / "📍 Зона" / "⏱ Длительность" outside these helpers.

---

## B. Formatter path used by each message surface

| # | Surface | Final formatter for service/zone/duration/date/time/master | Built from |
|---|--------|-------------------------------------------------------------|------------|
| 1 | /my_bookings list | `formatBookingCard(booking)` → `formatBookingBlock` | Backend path |
| 2 | Booking card in list items | Same as above | Backend path |
| 3 | Cancel confirmation | `formatBookingCard(booking)` → `formatBookingBlock` | Backend path |
| 4 | Cancel too-late message | `formatBookingCard(booking)` → `formatBookingBlock` | Backend path |
| 5 | Reschedule start screen | `formatBookingCard(booking)` → `formatBookingBlock` | Backend path |
| 6 | Reschedule old booking card | `session.rescheduleOldSummary` (set once = `formatBookingCard(booking)`) → `formatBookingBlock` | Backend path (cached) |
| 7 | Reschedule new booking card | `formatBookingCardFromParts(sessionToCardParts(session))` → `formatBookingBlock` | Session path |
| 8 | Reschedule success message | `formatBookingCardFromParts({ ...sessionToCardParts(session), date, time })` → `formatBookingBlock` | Session path |
| 9 | Wizard summary | `buildSummary(session)` = `formatBookingCardFromParts(sessionToCardParts(session))` → `formatBookingBlock` | Session path |
| 10 | Nearest-slot message | `formatBookingCardFromParts({ ...sessionToCardParts(session), date, time })` → `formatBookingBlock` | Session path |
| 11 | Confirmation screen | `buildConfirmText` → `formatBookingBlock(parts)` or `formatBookingCardFromParts(parts)`; parts from `sessionToCardParts(session)` | Session path |
| 12 | Booking created success | `formatBookingCardFromParts({ ...sessionToCardParts(session), date, time })` → `formatBookingBlock` | Session path |
| 13 | Service selection intro | Not a booking block; catalog/deeplink only | `formatCatalogIntro(item)` (standalone lines) |
| 14 | Master selection intro | Intro = `formatCatalogIntro(item)` or "Зона изменена..."; summary above master list = `buildSummary(session)` | Session path for summary; intro from catalog |
| 15 | Date selection summary | `buildSummary(session)` → `formatBookingCardFromParts(sessionToCardParts(session))` | Session path |
| 16 | Time selection summary | `buildSummary(session)` → same | Session path |

**Conclusion:** Every surface that shows a booking block uses either `formatBookingCard` (backend data) or `formatBookingCardFromParts(sessionToCardParts(session))` (session data), both of which end in `formatBookingBlock`. No manual concatenation of "📋 Услуга:" / "📍 Зона:" / "⏱ Длительность:" exists outside `formatBookingBlock` and `formatCatalogIntro`.

---

## C. Category-specific rendering audit (session path vs backend path)

### Session path (wizard, confirm, success, nearest slot, reschedule “new” card)

**Data source:** `sessionToCardParts(session)` uses:
- `session.category` (normalized via `normalizeCategory`)
- `session.serviceName` (e.g. "Лазерная эпиляция — 20 мин" or "Электроэпиляция — 60 мин")
- `session.catalogTitle`, `session.catalogElectroZone`
- `session.durationMin`, `session.masterName`, `session.dateStr`, `session.timeStr`

**LASER:**  
- procedureType: `getProcedureTypeForSession("LASER", session.serviceName)` → `CATEGORY_TO_PROCEDURE["LASER"]` = "Лазерная эпиляция" (category normalized).  
- zone: `session.catalogTitle` or `catalogElectroZone` (e.g. "Голени"); not suppressed.  
- duration: `session.durationMin`.  
- **Matches rules:** Yes, provided `session.category` is set and normalized (e.g. from catalog or startWizardWithService extra).

**WAX:**  
- Same as LASER with "Восковая депиляция".  
- **Matches rules:** Yes under same condition.

**ELECTRO:**  
- procedureType: `getProcedureTypeForSession("ELECTRO", ...)` → "Электроэпиляция".  
- zone: `isElectro = (normalizeCategory(session.category) === "ELECTRO")` → zone forced to `undefined`, `suppressZone: true`.  
- duration: `session.durationMin`.  
- **Matches rules:** Yes when `session.category` is set to ELECTRO (e.g. from catalog/deeplink).  
- **Gap:** If user enters wizard without category (e.g. reschedule sets only serviceId/serviceName/durationMin, not category), then `cat` is undefined, `suppressZone` is false, but zone is still undefined (catalogTitle/catalogElectroZone not set in reschedule). So no wrong zone line. Procedure type falls back to `stripTrailingDuration(session.serviceName)` = "Электроэпиляция" for "Электроэпиляция — 60 мин". So reschedule “new” card remains correct.

**MASSAGE:**  
- procedureType: MASSAGE + serviceName → stripped subtype or "Массаж".  
- zone: only if not ELECTRO and catalogTitle/catalogElectroZone set.  
- **Matches rules:** Yes; zone only when meaningful.

### Backend path (list, cancel, reschedule old card, too-late messages)

**Data source:** `formatBookingCard(booking)` uses:
- `booking.service.name` (from API, e.g. "Laser 20 min", "Electro 60 min")
- `booking.service.zone` (from API)
- `booking.service.durationMin`
- `isElectro = booking.service.name.trim().toLowerCase().startsWith("electro")` → then zone set to undefined and `suppressZone: true`

**LASER:**  
- procedureType: `formatServiceNameOnly(service)` from `service.name` (e.g. "Laser 20 min") → "Лазерная эпиляция".  
- zone: `service.zone` (backend sends catalog titleRu for zone-based).  
- **Matches rules:** Yes, assuming backend sends `service.name` like "Laser N min" and zone from catalog.

**WAX:**  
- Same with "Waxing N min" and zone.  
- **Matches rules:** Yes under same assumption.

**ELECTRO:**  
- procedureType: "Electro N min" → "Электроэпиляция".  
- zone: Forced to undefined when `isElectro`; `suppressZone: true`. Backend may still send `service.zone = "60 минут"` for time packages; bot ignores it.  
- **Matches rules:** Yes on bot side.

**MASSAGE:**  
- procedureType from `formatServiceNameOnly(service)` (Massage subtype or "Массаж").  
- zone: from API; not suppressed.  
- **Matches rules:** Yes.

**Backend payload note:** `getUpcomingBookingsByTelegramId` (booking.service.ts) sets `zone = \`${svc.durationMin} минут\`` for electro time packages when no catalog zone. Bot ignores this by not passing zone and setting suppressZone when `service.name` starts with "electro".

---

## D. All remaining ELECTRO rendering failures

**Current code behavior:**

1. **Backend path:** `formatBookingCard` sets `isElectro = rawName.toLowerCase().startsWith("electro")`, then `zone = undefined` and `suppressZone: true`. So "📋 Услуга: 120 минут" and "📍 Зона: 120 минут" do **not** occur for ELECTRO as long as `service.name` from API starts with "electro" (e.g. "Electro 120 min").  
2. **Session path:** `sessionToCardParts` sets `suppressZone: true` and `zone = undefined` when `normalizeCategory(session.category) === "ELECTRO"`. So ELECTRO never shows a zone line when category is set. When category is missing (e.g. reschedule), zone is still undefined (no catalogTitle set), and procedure type comes from stripped serviceName ("Электроэпиляция — 60 мин" → "Электроэпиляция").

**Remaining risk (data / backend):**

- **"📋 Услуга: 120 минут"** can only occur if `service.name` (backend) does **not** start with "Electro" and is something like "120 минут" or a duration-only label. Then `formatServiceNameOnly` returns that string. **Mitigation:** Ensure `Service.name` in DB is always the internal pattern (e.g. "Electro 120 min"). Bot does not receive category from upcoming-bookings API; it infers ELECTRO only from `service.name`. So if backend ever sent a service with a non-standard name (e.g. display label as name), the service line could be wrong. **No remaining bot-side path** that intentionally renders ELECTRO as zone or duration on the service line when `service.name` is correct.
- **"📍 Зона: 120 минут"** for ELECTRO: Bot does **not** render zone when `service.name` starts with "electro" (backend path) or when `session.category` normalizes to "ELECTRO" (session path). So no remaining **code path** in the bot that shows a zone line for ELECTRO. Backend still sending `zone: "60 минут"` does not affect display because the bot discards it.

**Conclusion:** With current bot code and backend sending `service.name` like "Electro 60 min", there are **no remaining ELECTRO rendering failures** in the bot. Any "Услуга: 120 минут" or "Зона: 120 минут" would be due to backend/data (e.g. wrong `Service.name` or a different API shape). No additional bot-side ELECTRO paths need to be fixed for zone/suppression.

---

## E. All remaining LASER/WAX duplication failures

**Current code behavior:**

1. **Session path:**  
   - Procedure type: `getProcedureTypeForSession(session.category, session.serviceName)` with **normalized** category. So "LASER" / "WAX" (or "laser" / "wax" from API normalized to "LASER" / "WAX") yield "Лазерная эпиляция" / "Восковая депиляция".  
   - Zone: `session.catalogTitle` or `session.catalogElectroZone` when not ELECTRO.  
   So the service line is never the zone **unless** category is missing or not in `CATEGORY_TO_PROCEDURE` and the fallback `stripTrailingDuration(session.serviceName)` equals the zone (e.g. if `session.serviceName` were set to "Голени" somewhere). Callers set `session.serviceName` from `formatServiceDisplayName(item.service)` or `formatServiceDisplayName(booking.service)`, which use `item.service.name` / `booking.service.name` (e.g. "Laser 20 min"), so under current code `session.serviceName` is not the zone.  
   **Remaining risk:** If the catalog API ever returned `item.category` in a form that does not normalize to "LASER"/"WAX" (e.g. typo or new value), or if `session.category` were never set for a LASER/WAX flow, the fallback would use `session.serviceName`. If that were ever set to a zone name (e.g. by a different code path or backend shape), duplication could appear. **No such path found in current code.**

2. **Backend path:**  
   - Procedure type: `formatServiceNameOnly(booking.service)` from `booking.service.name` only (displayName is not used). So "Laser 20 min" → "Лазерная эпиляция".  
   - Zone: `booking.service.zone`.  
   So duplication would only occur if the API sent `service.name` equal to the zone (e.g. "Голени"). That would be a backend/data issue (e.g. Service.name set to catalog title). **No bot code path** sets the service line to zone for LASER/WAX when backend sends correct `service.name`.

**Conclusion:** With current code and normalized category + correct session.serviceName and backend service.name, there are **no remaining LASER/WAX duplication paths** in the bot. Any duplication would require wrong data (e.g. category not set, or service.name = zone in DB/API).

---

## F. Manual / stale message templates still in use

**Search for manual "📋 Услуга" / "📍 Зона" / "⏱ Длительность" / "Мастер" / "Дата" / "Время":**

- **formatters.ts:** The only place that builds these lines is `formatBookingBlock` (and `formatCatalogIntro` builds 📋/📍/⏱/💳 for the intro only). No other file assembles these strings.
- **bookingFlow.ts:** No manual templates; all card text goes through `buildSummary`, `formatBookingCardFromParts`, or `formatBookingCard`.
- **bot.ts:** No manual booking block; uses `formatBookingCard` and `buildBookingListMessage`.
- **catalogFlow.ts:** Uses `formatCatalogIntro`; the only other booking-related string is "Зона изменена. Выберите мастера и время заново." (no card).
- **deeplink.ts:** `formatCatalogIntro` builds the intro lines; no other booking block.

**Conclusion:** There are **no remaining manual/stale booking block templates** that bypass the shared formatter. All service/zone/duration/master/date/time lines for booking blocks come from `formatBookingBlock` (via `formatBookingCard` or `formatBookingCardFromParts`). Catalog intro is the single other pattern and uses `formatCatalogIntro` with category normalization and ELECTRO zone suppression.

---

## G. Surface-by-category matrix

| Surface | LASER | WAX | ELECTRO | MASSAGE | Formatter path | Status |
|---------|-------|-----|---------|---------|----------------|--------|
| 1. /my_bookings list | procedure + zone from API | same | procedure + duration, no zone | procedure + zone if any | formatBookingCard | **correct** |
| 2. Booking card in list | same | same | same | same | formatBookingCard | **correct** |
| 3. Cancel confirmation | same | same | same | same | formatBookingCard | **correct** |
| 4. Cancel too-late | same | same | same | same | formatBookingCard | **correct** |
| 5. Reschedule start screen | same | same | same | same | formatBookingCard | **correct** |
| 6. Reschedule old card | same | same | same | same | rescheduleOldSummary (formatBookingCard) | **correct** |
| 7. Reschedule new card | sessionToCardParts → FromParts | same | suppressZone, no zone | same | session path | **correct** (category may be unset in reschedule; zone still undefined, procedure from serviceName) |
| 8. Reschedule success | same | same | same | same | session path | **correct** |
| 9. Wizard summary | sessionToCardParts → FromParts | same | suppressZone | same | buildSummary | **correct** |
| 10. Nearest-slot message | same | same | same | same | formatBookingCardFromParts(session) | **correct** |
| 11. Confirmation screen | same | same | same | same | buildConfirmText → FromParts/Block | **correct** |
| 12. Booking created success | same | same | same | same | formatBookingCardFromParts(session) | **correct** |
| 13. Service selection intro | N/A (catalog) | N/A | N/A | N/A | formatCatalogIntro | **correct** (no zone for ELECTRO) |
| 14. Master selection intro | intro from formatCatalogIntro; summary from buildSummary | same | intro no zone; summary suppressZone | same | intro + buildSummary | **correct** |
| 15. Date selection summary | buildSummary | same | same | same | session path | **correct** |
| 16. Time selection summary | buildSummary | same | same | same | session path | **correct** |

**Assumptions for “correct”:**  
- Backend sends `service.name` in internal form (Laser/Waxing/Electro/Massage + duration).  
- Session has `category` set when coming from catalog/deeplink (so ELECTRO gets suppressZone and LASER/WAX get correct procedure type).  
- Reschedule does not set category, but also does not set catalogTitle/catalogElectroZone, so zone stays undefined and procedure type from serviceName is correct.

**Potentially broken only if:**  
- Backend sends `service.name` = zone or duration label (e.g. "Голени", "120 минут") → would show on service line (data/backend).  
- Session.category missing and session.serviceName wrong (e.g. zone) → would show on service line (no such path found).  
- Backend sends wrong or missing category from catalog (e.g. not in LASER/WAX/ELECTRO/MASSAGE) → normalization returns undefined; fallback uses serviceName (acceptable if serviceName is procedure type).

---

## H. Minimal safe fix strategy

**Findings:**

1. **Single formatter:** All booking blocks already go through `formatBookingBlock` (via `formatBookingCard` or `formatBookingCardFromParts`). No second formatter or manual block building.
2. **No bypass:** No surface builds "📋 Услуга" / "📍 Зона" / "⏱ Длительность" manually; no stale templates found.
3. **Category normalization:** Already used in `getProcedureTypeForSession` and `sessionToCardParts`; `formatCatalogIntro` uses `normalizeCategory` for ELECTRO zone suppression and labels.
4. **ELECTRO zone:** Backend path suppresses zone when `service.name` starts with "electro"; session path suppresses when `normalizeCategory(session.category) === "ELECTRO"`. No additional bot change needed for ELECTRO.
5. **Backend shaping:** Bot does not require backend changes for correct display: it ignores zone for ELECTRO and derives procedure type from `service.name`. Optional improvement: backend could stop sending `zone` for electro time packages to avoid confusion in other clients; not required for this bot.

**Recommended minimal safe actions (no code change in this audit):**

1. **Keep current bot logic:** No change to formatter chain or entry points.
2. **Data/backend checks (optional):**  
   - Ensure `Service.name` in DB is always the internal pattern (e.g. "Electro 60 min", "Laser 20 min", "Waxing 25 min"), never a zone or duration-only label.  
   - Ensure catalog API returns `category` as one of LASER/WAX/ELECTRO/MASSAGE (or values that normalize to these) so session path gets correct procedure type and ELECTRO suppression.
3. **Reschedule flow (optional hardening):** When starting reschedule, could set `session.category` from booking if backend ever exposes category on `UpcomingBookingItem.service` (e.g. `service.category`). Then ELECTRO would be explicitly suppressZone even in reschedule. Currently not required because zone is undefined and procedure type from serviceName is correct.
4. **No redirect needed:** All surfaces already use the unified helper; no old manual templates to redirect.

**Conclusion:** The current implementation already applies the intended category rules and a single formatter path. The smallest safe “fix” is to **leave bot code as is** and only validate/backfill data and API so `service.name` and (where used) `category` match the assumptions above. If specific production cases still show "Услуга: 120 минут" or "Зона: 120 минут" for ELECTRO, or duplicated service/zone for LASER/WAX, the cause is likely backend payload or DB content, not an unused or bypassed formatter.

---

*This report is diagnostic only. No code or formatting was changed.*
