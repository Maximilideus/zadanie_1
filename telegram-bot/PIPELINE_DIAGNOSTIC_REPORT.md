# Production-Safe Read-Only Diagnostic Report
## Incorrect Booking Text: "120 минут" / "Голени" on Услуга and Зона

**Rules observed:** No code, database, or formatting changes. Diagnostic only.

---

## 1. Service data inventory

### Service model (Prisma schema)

**Location:** `backend/prisma/schema.prisma`

**Service model fields relevant to display:**

| Field | Type | Notes |
|-------|------|--------|
| `id` | String | UUID |
| `name` | String | **Internal identifier**; used by backend as `service.name` in API |
| `durationMin` | Int | Used for duration line and for electro zone fallback |
| `category` | CatalogCategory? | ELECTRO, LASER, WAX, MASSAGE; used for `isElectroTimePackage` |
| `groupKey` | String? | "time" for electro time packages; used with category for `isElectroTimePackage` |
| `zoneKey` | String? | Semantic zone (e.g. "lower-legs"); not sent to bot as display text |

**Important:** The **Service** model has **no `titleRu`** field. Only **CatalogItem** has `titleRu` (zone/duration labels like "Голени", "120 минут").

### Where Service rows come from

**A. Main seed (`backend/prisma/seed.ts`)**

- Creates services with **internal names only**:
  - LASER: `"Laser 15 min"`, `"Laser 30 min"`, …, `"Laser 120 min"`
  - ELECTRO: `"Electro 15 min"`, …, `"Electro 120 min"`
  - WAX: `"Waxing 15 min"`, …, `"Waxing 60 min"`
  - MASSAGE: `"Massage Classic 60 min"`, etc.
- No Russian text in `Service.name` from this seed.

**B. Electro zone script (`backend/scripts/seed-electro-zone-services.ts`)**

- **Creates Service rows with `name: zone.name`** where `zone.name` is **Russian** (e.g. "Голени", "Верхняя губа", "Подбородок", "Ноги полностью").
- These services are created with:
  - `category: "ELECTRO"`, `groupKey: "face"` or `"body"` or `"intimate"`
  - `isBookable: false`, `showInBot: false`, `durationMin: 0`, `price: 0`
- So **two naming conventions** exist in the DB:
  1. **Bookable services:** `Service.name` = internal ("Electro 120 min", "Laser 20 min", "Голени" only if a booking were ever linked to an electro-zone Service).
  2. **Electro zone (info) services:** `Service.name` = Russian zone name ("Голени", "Верхняя губа", …).

**C. CatalogItem (not Service)**

- **CatalogItem** has `titleRu` with values like:
  - Zone: "Голени", "Бёдра", "60 минут", "120 минут" (electro time offers).
- ELECTRO time offers in seed: `titleRu: "15 минут"`, `"30 минут"`, …, `"120 минут"`.
- CatalogItems are **linked** to Service by `serviceId`; they do **not** set `Service.name`. Linking is done by matching **Service.name** to a resolved internal name (e.g. "Electro 120 min") in `seedCatalogItems` and `linkCatalogItemsToServices`.

### Inventory conclusion

- **Service rows with category ELECTRO/LASER/WAX/MASSAGE:** From seed → internal `name` only.
- **Service rows with `name` containing "минут":** Not created by main seed or by `seedCatalogItems`. They would exist only if:
  - Another script or admin created a Service with `name = "120 минут"` (or similar), or
  - Data was migrated/copied from CatalogItem.titleRu into Service.name.
- **Service rows with zone-like Russian names ("Голени", etc.):** Created by **seed-electro-zone-services**; those rows are `isBookable: false`, `showInBot: false`. If a **booking** were ever associated with one of these Service IDs (e.g. wrong link or admin choice), the API would return `service.name = "Голени"` and the bot would show "Услуга: Голени".

---

## 2. Expected vs actual Service data model

### Intended structure (from schema and seed)

| Field | Intended meaning |
|-------|-------------------|
| **Service.name** | Internal, stable identifier for display logic and linking: English + duration, e.g. "Electro 120 min", "Laser 20 min", "Waxing 25 min", "Massage Relax 60 min". **Not** a user-facing Russian zone or duration label. |
| **Service.category** | Catalog category (ELECTRO, LASER, WAX, MASSAGE) for business rules. |
| **Service.groupKey** | "time" for electro time packages; face/body/intimate for zones. |
| **Service.durationMin** | Duration in minutes. |
| **Service.zoneKey** | Optional semantic zone key; not the display label. |

**CatalogItem.titleRu** is the intended place for Russian zone/duration labels ("Голени", "120 минут"). The backend uses it to build **zone** for the API (first catalog item per service by sortOrder), and for electro time packages it can also set zone to `"${durationMin} минут"` when no catalog zone exists.

### Where the model is violated

1. **seed-electro-zone-services** writes **Russian zone names** into **Service.name** ("Голени", "Верхняя губа", …). Those rows are non-bookable; the violation is that **any** booking linked to such a service would get wrong `service.name` for the formatter.
2. If **any** Service row has **`name = "120 минут"`** (or similar), that violates the intended model and directly produces the bad output "📋 Услуга: 120 минут". No such creation path was found in the inspected seed/link scripts; it would require manual or other script/admin input.

---

## 3. Backend payload construction

**Source:** `backend/src/modules/booking/booking.service.ts` — `getUpcomingBookingsByTelegramId(telegramId)`.

**Flow:**

1. Load bookings (id, status, scheduledAt, serviceId, masterId).
2. Load **Service** by booking.serviceId: `select: { id, name, durationMin, category, groupKey }`.
3. Load **CatalogItem** where `serviceId` in those service IDs: `select: { serviceId, titleRu, sortOrder }`, ordered by sortOrder.
4. Build:
   - **serviceById:** for each Service, `{ name: s.name, displayName: getServiceDisplayName(s.name), durationMin, isElectroTimePackage: s.category === "ELECTRO" && s.groupKey === "time" }`.
   - **zoneByServiceId:** for each catalog item (first per serviceId), `zoneByServiceId[serviceId] = item.titleRu`. Then for **electro time packages** when no catalog zone: `zone = \`${svc.durationMin} минут\``.
5. For each booking, return:
   - **service.name** = `svc.name` (from DB).
   - **service.displayName** = `getServiceDisplayName(s.name)` (not used by bot for card).
   - **service.zone** = zone from catalog or, for electro time, `"N минут"` when no catalog zone.
   - **service.durationMin** = from Service.
   - **service.isElectroTimePackage** = from Service (category + groupKey).

**Important:** The backend **never** sets `service.name` from CatalogItem.titleRu. It always sets `service.name` from **Service.name** (DB). So if the DB has `Service.name = "120 минут"`, the API will send that and the bot will show it.

---

## 4. Example booking payload returned to bot

**Endpoint:** `GET /bookings/user/:telegramId/upcoming`  
**Handler:** `getUpcomingBookingsHandler` → `getUpcomingBookingsByTelegramId(telegramId)`.

**Example structure (one booking):**

```json
{
  "id": "<booking-uuid>",
  "status": "PENDING",
  "scheduledAt": "<ISO date-time>",
  "serviceId": "<service-uuid>",
  "service": {
    "name": "Electro 120 min",
    "displayName": "Электроэпиляция",
    "zone": "120 минут",
    "durationMin": 120,
    "isElectroTimePackage": true
  },
  "masterName": "Anna"
}
```

- **Correct case:** `service.name` = "Electro 120 min" → bot derives procedure "Электроэпиляция", suppresses zone → no "Зона: 120 минут".
- **Bad case:** If `service.name` = "120 минут" (wrong DB), then procedure becomes "120 минут", zone is still "120 минут" (from backend), and bot does not suppress zone (no "electro" prefix) → "📋 Услуга: 120 минут", "📍 Зона: 120 минут".

**Note:** The API does **not** send `service.category`. The bot infers ELECTRO only from `service.name.startsWith("electro")`.

---

## 5. Formatter input mapping

### Backend path: `formatBookingCard(booking)`

**File:** `telegram-bot/src/services/formatters.ts`

| Display line | Source in formatter |
|--------------|----------------------|
| **📋 Услуга** | `procedureType` = `formatServiceNameOnly(booking.service)` → from **booking.service.name** only. If name does not start with Waxing/Laser/Electro/Massage, returns stripped or raw string (e.g. "120 минут" if name is "120 минут"). |
| **📍 Зона** | `zone` = `booking.service.zone` **only when** `!isElectro`; `isElectro` = `booking.service.name.trim().toLowerCase().startsWith("electro")`. So if name is not "Electro...", zone is shown. |
| **⏱ Длительность** | `parts.durationMin` = **booking.service.durationMin**. |

**Derivation:**

- **procedureType:** `formatServiceNameOnly(service)` checks `service.name`: Waxing → "Восковая депиляция", Laser → "Лазерная эпиляция", Electro → "Электроэпиляция", Massage → subtype or "Массаж". Otherwise: strip `\s+\d+\s*min\s*$` from name; if nothing left or no "min", return raw → so **"120 минут"** stays **"120 минут"**.
- **zone:** Passed through from payload unless `isElectro`; then forced to undefined and `suppressZone: true`.
- **durationMin:** Passed through; rendered as "N мин".

### Session path: `sessionToCardParts` → `formatBookingCardFromParts`

- **procedureType** = `getProcedureTypeForSession(session.category, session.serviceName)` (category normalized; fallback stripped serviceName).
- **zone** = for ELECTRO set to undefined and `suppressZone: true`; otherwise `session.catalogElectroZone ?? session.catalogTitle`.
- **durationMin** = `session.durationMin`.

---

## 6. Runtime conditions that produce bad output

To get **exactly**:

- 📋 Услуга: 120 минут  
- 📍 Зона: 120 минут  
- ⏱ Длительность: 120 мин  

with **current** formatter code (backend path), the **exact** input must be:

| Input | Value |
|-------|--------|
| **booking.service.name** | **"120 минут"** (or any string that does not start with "electro" and that `formatServiceNameOnly` returns as "120 минут") |
| **booking.service.zone** | **"120 минут"** |
| **booking.service.durationMin** | **120** |

**Why:**  
- procedureType = formatServiceNameOnly(service) with name "120 минут" → no Waxing/Laser/Electro/Massage; no "min" at end → returns "120 минут".  
- isElectro = false → zone is not suppressed, so "📍 Зона: 120 минут" is shown.  
- durationMin = 120 → "⏱ Длительность: 120 мин".

So the **only** way the current code produces this bad output is that the **backend sends `service.name = "120 минут"`**. That in turn means the **Service** row for that booking has **name = "120 минут"** in the database (or another response path that we did not inspect sets name differently).

---

## 7. Service naming inconsistencies

**Conventions found:**

| Convention | Where | Example | Used for |
|------------|--------|---------|----------|
| **Internal (English + duration)** | seed.ts, linkCatalogItemsToServices, seedCatalogItems | "Electro 120 min", "Laser 20 min", "Waxing 25 min", "Massage Relax 60 min" | Bookable services; formatter expects these prefixes. |
| **Russian zone name in Service.name** | seed-electro-zone-services.ts | "Голени", "Верхняя губа", "Ноги полностью" | Electro zone (info) services; isBookable: false. If a booking ever points here, bot shows "Услуга: Голени". |
| **Russian duration label** | CatalogItem.titleRu only (electro time) | "15 минут", "60 минут", "120 минут" | Display in catalog; backend copies to **service.zone** (and for electro time can set zone = "N минут"). **Not** intended to be in Service.name. |

**Conclusion:** If **any** bookable booking is linked to a Service whose **name** is:

- a Russian zone name ("Голени"), or  
- a Russian duration label ("120 минут"),  

then the bot will show that value on the "Услуга" line and, for zone, either the same (duplication) or the backend-supplied zone. The intended design is that **Service.name** is always the internal form; the only code that writes Russian into Service.name is **seed-electro-zone-services** (non-bookable rows). So either:

- a bookable Service was incorrectly created/updated with name "120 минут" or "Голени", or  
- a booking was linked to a non-bookable electro-zone Service ("Голени"), or  
- another code path (e.g. admin or migration) sets Service.name to a Russian label.

---

## 8. Final root cause determination

**Most likely cause:** **A. Incorrect Service rows in DB** and/or **E. Multiple inconsistent service naming conventions**.

- **A.** If there are Service rows with **name = "120 минут"** or **name = "Голени"** (or other Russian labels) that are **bookable** or that have bookings, then the backend will return that as `service.name` and the bot will render it on the "Услуга" line and, when not suppressed, on the "Зона" line. The formatter behaves as coded; the input is wrong.
- **E.** Two conventions exist: internal names in seed vs Russian names in seed-electro-zone-services. If bookings or catalog links ever point to the wrong kind of Service, or if Service.name was overwritten by a script/admin with catalog titleRu, the same bad output appears.

**Less likely in current codebase:**

- **B. Backend payload shaping:** Backend always sets `service.name` from `Service.name` (DB). It does not set it from CatalogItem.titleRu. So wrong payload implies wrong DB (or a different backend path not inspected).
- **C. Formatter receives wrong input:** That is a consequence of the payload; the formatter does not fetch data itself.
- **D. Stale bot process:** Would explain bad output only if the running process is an old build that does not suppress zone for ELECTRO; after restart with current code, if DB is correct, the problem should go away for ELECTRO. For "120 минут" on the service line, the only way is wrong `service.name` in the payload.

**Recommended verification (no changes):**

1. **Database:** Query Service rows that have **bookings** (or are linked from bookable catalog items) and check whether any have `name` like `"%минут%"` or Russian zone names ("Голени", etc.). If yes, that is the root cause.
2. **Backend response:** For a telegramId that reproduces the issue, log or inspect the JSON from `GET /bookings/user/:telegramId/upcoming` and confirm `service.name` for the affected booking. If it is "120 минут" or "Голени", the source is the DB (or whatever populates that Service).
3. **Bot:** Ensure the running process is the current code (restart). If the problem persists, the payload is wrong (point 2).

---

*This report is diagnostic only. No code, database, or formatting was modified.*
