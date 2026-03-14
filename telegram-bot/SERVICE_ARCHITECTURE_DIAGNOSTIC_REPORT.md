# Service Architecture Diagnostic Report
## How Services Are Modeled and Selected (Telegram Bot Booking Flows)

**Rules observed:** No code, database, or formatting changes. Diagnostic only.

---

## 1. Relevant schema/models

### Service (`backend/prisma/schema.prisma`)

| Aspect | Details |
|--------|--------|
| **Purpose** | Core bookable or display entity: time-based packages (e.g. Electro 120 min), zone-based services (e.g. Laser/Wax by zone), or ELECTRO display-only zones. |
| **Key fields** | `id`, `name`, `durationMin`, `price`, `category` (CatalogCategory?), `gender`, `groupKey`, `zoneKey`, `isBookable`, `showOnWebsite`, `showInBot`, `sessionDurationLabelRu`, `sessionsNoteRu`, `courseTermRu`, `sourceCatalogItemId`, `locationId` |
| **Usage** | Bookings reference `Booking.serviceId` → Service. Masters are linked via MasterService. CatalogItems can link to Service via `serviceId`. |
| **Bookable vs display** | **Bookable:** `isBookable: true` (default). **Display-only:** electro zone rows from `seed-electro-zone-services` have `isBookable: false`, `showInBot: false`, `showOnWebsite: true`. |

**Field meanings:**

- **Service.name** — Internal identifier. Intended: English + duration for bookable (e.g. "Electro 120 min", "Laser 20 min"). Electro zone rows use Russian zone name (e.g. "Голени") for website table display.
- **Service.category** — `LASER` \| `WAX` \| `ELECTRO` \| `MASSAGE` (optional). Used with `groupKey` to distinguish ELECTRO time (`"time"`) vs ELECTRO zones (face/body/intimate).
- **Service.groupKey** — `"time"` = time-based package (ELECTRO only); `"face"` \| `"body"` \| `"intimate"` = zone grouping. Bookable ELECTRO = `category === "ELECTRO"` and `groupKey === "time"`.
- **Service.durationMin** — Duration in minutes. For electro zones (display-only) often `0`.

---

### CatalogItem

| Aspect | Details |
|--------|--------|
| **Purpose** | Catalog entry for website/bot: zone or offer with Russian titles, price, link to Service. Can be ZONE, OFFER, INFO, or PACKAGE. |
| **Key fields** | `id`, `category`, `type`, `gender`, `groupKey`, `titleRu`, `subtitleRu`, `price`, `durationMin`, `serviceId`, `isVisible`, `sortOrder`, `locationId` |
| **Usage** | Grouped catalog API builds sections from Services + “fallback” CatalogItems. Bot shows catalog by category; on selection fetches item by id and uses `item.serviceId` (Service) for booking. |
| **Bookable vs display** | **Bookable:** items with `serviceId` set and linked to a bookable Service. **Display-only:** ELECTRO INFO items (zones) have `serviceId` → "Electro 15 min" for pricing reference but are not the “product” sold; ELECTRO is sold by time (OFFER, groupKey `"time"`). |

**Field meanings:**

- **CatalogItem.titleRu** — Russian display label (e.g. "Голени", "120 минут", "Классический массаж").
- **CatalogItem.category** — Same enum as Service: LASER, WAX, ELECTRO, MASSAGE.
- **CatalogItem.groupKey** — Section grouping: `"face"`, `"body"`, `"intimate"`, `"time"`, `"info"`, `"massage"`, etc. ELECTRO time offers use `"time"`.

---

### Category / groupKey / type enums

- **CatalogCategory:** LASER, WAX, ELECTRO, MASSAGE.
- **CatalogItemType:** ZONE (zone/position), OFFER (sellable slot, e.g. time package), INFO (informational), PACKAGE.
- **CatalogGender:** FEMALE, MALE, UNISEX.

---

### Relation: Service ↔ CatalogItem

- **CatalogItem.serviceId** → Service (optional). Many CatalogItems can point to one Service (e.g. several zones → one "Laser 20 min").
- **Service** has no direct FK to CatalogItem; `Service.sourceCatalogItemId` is for migration/backfill only.
- **Booking** → `Booking.serviceId` → Service. Booking is always by Service, not by CatalogItem.

---

### Booking → Service linkage

- **Booking.serviceId** (optional) references **Service.id**. All booking flows (including Telegram) resolve to a Service and store `serviceId`. Display text for the booking card is derived from Service (name, durationMin) and from CatalogItem (first linked item’s titleRu → zone).

---

## 2. Real data shapes (from seeds and scripts)

*No live DB was queried; shapes are inferred from schema and seed/script code.*

### A. ELECTRO time-based services (bookable)

**Source:** `backend/prisma/seed.ts` (no `category`/`groupKey` set).

| Field | Example |
|-------|--------|
| id | (UUID) |
| name | "Electro 15 min", "Electro 30 min", …, "Electro 120 min" |
| category | `null` (seed does not set it) |
| groupKey | `null` |
| durationMin | 15, 30, 45, 60, 90, 120 |
| titleRu / title | N/A on Service; CatalogItem has titleRu "15 минут", …, "120 минут" |
| Bookable/display | **Bookable.** Included by `whereBookableService()` because `category !== "ELECTRO"` (null). |

**Note:** If these rows are later updated to `category: "ELECTRO"`, `groupKey: "time"`, they become the canonical “ELECTRO time” services and `isElectroTimePackage` in booking payloads would be true.

---

### B. ELECTRO zone/display entries (non-bookable, informational)

**Source:** `backend/scripts/seed-electro-zone-services.ts`.

| Field | Example |
|-------|--------|
| id | (UUID) |
| name | "Голени", "Верхняя губа", "Подбородок", "Ноги полностью", etc. |
| category | "ELECTRO" |
| groupKey | "face" \| "body" \| "intimate" |
| durationMin | 0 |
| sessionDurationLabelRu, etc. | "15 мин", "8–12 сеансов", "6–9 месяцев" (for website table) |
| isBookable | **false** |
| showInBot | **false** |
| showOnWebsite | true |
| Bookable/display | **Display-only.** Used for the electro zone table on the website. Must not be used for booking. |

---

### C. LASER services

**Source:** `seed.ts` (no category/groupKey).

| Field | Example |
|-------|--------|
| name | "Laser 15 min", "Laser 30 min", …, "Laser 120 min" |
| category | `null` |
| groupKey | `null` |
| durationMin | 15, 30, …, 120 |
| Bookable/display | **Bookable.** Zone titles come from CatalogItem (titleRu); each zone item links to the appropriate Service by duration. |

CatalogItem (seedCatalogItems): ZONE items with titleRu "Голени", "Бёдра", etc., linked to Services by `resolveLaserServiceName(durationMin)` (e.g. "Laser 20 min").

---

### D. WAX services

**Source:** `seed.ts`.

| Field | Example |
|-------|--------|
| name | "Waxing 15 min", "Waxing 25 min", …, "Waxing 60 min" |
| category | `null` |
| groupKey | `null` |
| durationMin | 15, 25, 35, 50, 60 |
| Bookable/display | **Bookable.** Same pattern as LASER: CatalogItem ZONE with titleRu, linked by `resolveWaxServiceName(durationMin)`. |

---

### E. MASSAGE services

**Source:** `seed.ts`.

| Field | Example |
|-------|--------|
| name | "Massage Classic 60 min", "Massage Relax 60 min", "Massage Sport 60 min", "Massage Lymph 60 min" |
| category | `null` |
| groupKey | `null` |
| durationMin | 60 |
| Bookable/display | **Bookable.** CatalogItem OFFER with titleRu "Классический массаж", etc., linked by title pattern to Service name. |

---

**Summary:** Bookable services are created in `seed.ts` with internal `name` and no category/groupKey. ELECTRO display-only rows are created in `seed-electro-zone-services.ts` with Russian `name`, `category: "ELECTRO"`, non-time `groupKey`, and `isBookable: false`, `showInBot: false`.

---

## 3. How the Telegram bot gets and displays services

### Endpoints used

1. **Catalog (grouped):** `GET /catalog/:category/grouped` → `getCatalogByCategoryGrouped`. Used for category → gender → zone/time selection.
2. **Catalog item by id:** `GET /catalog/item/:id` → `getCatalogItemById`. Used when user taps a catalog option; response includes `serviceId` and `service: { id, name, durationMin, price }`.
3. **Services list (optional):** `GET /telegram/services` → returns only **bookable** services (`whereBookableService()`), used for flows that list services by id/name (e.g. service picker), not for the main catalog flow.
4. **Booking creation/update:** `POST /telegram/bookings`, `POST /telegram/bookings/service`, etc. All use **Service.id** (from catalog item’s `service.id`).

### Which DB entities feed the catalog endpoint

- **Services:** `findServicesByLocationAndCategory(locationId, category)` — `Service` with `category`, `isVisible`, `showOnWebsite`. For ELECTRO this returns **only** the display-only zone Services (they have `category: "ELECTRO"`); bookable ELECTRO time services from seed have `category: null`, so they are **not** in this list.
- **Fallback CatalogItems:** `findFallbackCatalogItems(...)` — CatalogItems in that category not “covered” by Service.sourceCatalogItemId or Package. Includes ELECTRO OFFER items (groupKey `"time"`, titleRu "15 минут", …, "120 минут") and INFO items. These items have `serviceId` → bookable Service (e.g. "Electro 120 min").

So for ELECTRO, the **time** section in the grouped response is populated from **fallback CatalogItems** (OFFER, groupKey `"time"`), not from Service rows. Each such item’s `serviceId` points to the bookable Service.

### How ELECTRO is selected in the bot

1. User chooses category "Электроэпиляция" → bot calls `getCatalogGrouped("electro")`.
2. Bot calls **showElectroTimeServices**: it only uses **sections that have groupKey `"time"`** (`getElectroTimeItems(sections)` → `genderSections?.time`). So it shows only “Пакеты времени” items.
3. Buttons use `ci:${item.id}` (CatalogItem.id for time items).
4. On click, bot calls `getCatalogItemById(catalogItemId)` → gets `serviceId` and `service.id`.
5. Bot starts wizard with **`item.service.id`** (Service.id) and calls `setBookingService(telegramId, serviceId)` with that Service.id.

So ELECTRO selection in the bot is **time-only**; display-only electro zones never appear in this flow because the bot only renders the `"time"` section.

### Can display-only electro zones enter the booking flow?

- **Catalog API:** The grouped catalog does include ELECTRO zone Services (from `findServicesByLocationAndCategory`) in sections like `unisex.face`, `unisex.body`, etc. So at API level, zone entities are present.
- **Bot UI:** For ELECTRO, the bot **only** shows `showElectroTimeServices`, which uses only **sections.time** items (from fallback CatalogItems). So the bot never shows zone rows to the user for booking.
- **If a zone Service.id were sent:** `setBookingService` loads the Service and calls `assertElectroServiceBookable(service)`. If `category === "ELECTRO"` and `groupKey !== "time"`, it throws `ELECTRO_ZONE_NOT_BOOKABLE`. So even if something sent a zone Service id, the backend would reject it.

**Conclusion:** Display-only electro zones do not enter the Telegram booking flow in practice; the bot only shows time items and the backend blocks non-time ELECTRO services.

---

## 4. ELECTRO special case (dedicated section)

### Which ELECTRO entities are only for website display

- **Service rows** created by `seed-electro-zone-services.ts`: `name` = Russian zone (e.g. "Голени"), `category: "ELECTRO"`, `groupKey: "face"|"body"|"intimate"`, `isBookable: false`, `showInBot: false`, `showOnWebsite: true`. They populate the electro zone table (columns: zone, session time, sessions note, course term).
- **CatalogItem** ELECTRO INFO rows: zone titles for reference; some link to "Electro 15 min" for price display but are not the bookable product.

### Which ELECTRO entities are actually bookable

- **Service rows** "Electro 15 min", …, "Electro 120 min" from `seed.ts` (and optionally with `category: "ELECTRO"`, `groupKey: "time"` if set later).
- **CatalogItem** ELECTRO OFFER with `groupKey: "time"` (titleRu "15 минут", …, "120 минут"): these are the catalog entries for “packages of time”; each has `serviceId` → the corresponding bookable Service.

### How they are distinguished technically

| Criterion | Bookable ELECTRO | Display-only ELECTRO |
|----------|-------------------|----------------------|
| **Entity** | Service (name "Electro N min") | Service (name "Голени", etc.) |
| **category** | null (seed) or ELECTRO | ELECTRO |
| **groupKey** | null (seed) or "time" | "face" \| "body" \| "intimate" |
| **isBookable** | true | false |
| **showInBot** | true (default) | false |
| **Used in** | Booking, /telegram/services, catalog time section (via CatalogItem → Service) | Website electro table, catalog zone sections (not shown in bot for booking) |

Backend filters:

- **Bookable list:** `whereBookableService()` = `(category !== "ELECTRO") OR (category === "ELECTRO" AND groupKey === "time")`. So only non-ELECTRO or ELECTRO-time services.
- **Booking guard:** `assertElectroServiceBookable`: throws if `category === "ELECTRO"` and `groupKey !== "time"`.

### Which category/groupKey mark real bookable vs display ELECTRO

- **Bookable ELECTRO:** `category === "ELECTRO"` and **`groupKey === "time"`** (or, with current seed, category null so they pass the “not ELECTRO zone” check).
- **Display ELECTRO:** `category === "ELECTRO"` and **`groupKey !== "time"`** (face/body/intimate).

### Does the bot correctly filter to time-based ones?

Yes. The bot only shows ELECTRO items from **sections.time**, which are the fallback CatalogItems (OFFER, groupKey "time") linked to bookable Services. It never shows zone sections for ELECTRO booking.

### Does the backend payload mix display-only and bookable?

- **Grouped catalog:** The same response includes both (1) Services from `findServicesByLocationAndCategory` (ELECTRO zone Services) and (2) fallback CatalogItems (including ELECTRO time). So the payload contains both; the **bot** restricts what it shows (time only).
- **Booking payload (upcoming, etc.):** Built from `Booking.serviceId` → Service. So only Services that were actually booked appear; display-only zone Services are not bookable and are rejected by `assertElectroServiceBookable` if someone tried to use them.

---

## 5. Comparison with LASER / WAX / MASSAGE

### Why LASER/WAX don’t need the same “display-only vs bookable” split

- **ELECTRO:** Sold **by time** (e.g. 60 min slot). Zones are informational (what can be done in that time). So there are two concepts: (1) bookable time packages → Service "Electro N min", (2) zone table for the site → Service "Голени" (display-only).
- **LASER / WAX:** Sold **by zone** (e.g. “Голени”, “Подмышки”). Each sellable position is a CatalogItem ZONE linked to a Service (by duration). There are no separate “display-only” Service rows for zones; the same Service is used for both catalog display and booking. So no split.

### MASSAGE

- Sold as direct offers (e.g. “Классический массаж” → Service "Massage Classic 60 min"). One offer type per Service; no zone table. Behaves like “direct service” like LASER/WAX, without the ELECTRO time vs zone duality.

### Which categories are directly bookable

- **LASER, WAX, MASSAGE:** All bookable services from seed are included by `whereBookableService()` (category null or not ELECTRO). User picks zone/offer in catalog → CatalogItem → `serviceId` → Service → booking.
- **ELECTRO:** Only time-based Services (and in code, only those with `groupKey === "time"` when category is ELECTRO) are intended bookable; zone Services are explicitly non-bookable and guarded.

### CatalogItem-only display

- **ELECTRO INFO** items (zone names, “Финальная доработка после лазера”): display/info only; some link to "Electro 15 min" for price but are not the booked product. The **booked** product is always a time OFFER → Service.
- LASER/WAX/MASSAGE: CatalogItems (ZONE/OFFER) are the catalog display; each has `serviceId` and the **same** Service is what gets booked.

---

## 6. Naming conventions and inconsistencies

### Intended conventions

| What | Where | Intended content |
|------|--------|-------------------|
| Internal technical identity | **Service.name** | English + duration: "Electro 120 min", "Laser 20 min", "Waxing 25 min", "Massage Relax 60 min". Stable for linking and logic. |
| Russian display label | **CatalogItem.titleRu** | "Голени", "120 минут", "Классический массаж". |
| Body zone title | **CatalogItem.titleRu** (and for electro zone table, **Service.name** in zone rows) | Zone rows in seed-electro-zone-services use Service.name = Russian zone name for website table. |
| Duration label | **CatalogItem.titleRu** (e.g. "120 минут") or **subtitleRu** / "N мин" | Not intended to be stored in Service.name for bookable services. |

### DTOs

- **service.name** in booking payload: from **Service.name** (DB). Bot uses it for procedure type and for ELECTRO detection (e.g. `name.toLowerCase().startsWith("electro")`).
- **service.zone** in booking payload: from first CatalogItem (by sortOrder) for that Service (`titleRu`), or for ELECTRO time with no zone item: `"${durationMin} минут"`.
- **displayName:** Backend can derive a Russian label (e.g. “Электроэпиляция”) from Service.name; bot may use it in some surfaces. Main booking card logic uses Service.name and zone from payload.

### Inconsistencies / risk rows

- **Service.name = Russian zone name:** In **seed-electro-zone-services**, Service.name is set to Russian (e.g. "Голени"). Those rows are `isBookable: false`, `showInBot: false`. If a booking ever pointed to such a Service (e.g. bad data or admin), the card would show "Услуга: Голени".
- **Service.name = duration label like "120 минут":** Not created by the inspected seeds. If such a row existed (manual or other script), the booking payload would send it and the bot could show "📋 Услуга: 120 минут" and, if zone were also "120 минут", duplicate/wrong text.
- **Display-only in bookable space:** Electro zone Services are explicitly non-bookable and guarded; the only way they appear in booking is if something incorrectly set `Booking.serviceId` to their id (e.g. legacy or bug). Normal flows use only Service.id from catalog item’s `service.id`.

---

## 7. Booking payload explanation

### How the payload is built

**Source:** `getUpcomingBookingsByTelegramId` in `backend/src/modules/booking/booking.service.ts` (and same pattern where booking + service are returned).

- **service.name** — From **Service.name** (DB). Never from CatalogItem.titleRu.
- **service.zone** — From **CatalogItem**: first CatalogItem (by sortOrder) linked to that Service; payload uses `item.titleRu`. For ELECTRO time packages, if no catalog zone is found, backend sets `zone = \`${svc.durationMin} минут\``.
- **durationMin** — From **Service.durationMin**.
- **category / groupKey** — Read from Service for `isElectroTimePackage`; **not** sent to the bot. Bot infers “electro” from `service.name.toLowerCase().startsWith("electro")` to suppress the zone line.
- **isElectroTimePackage** — `s.category === "ELECTRO" && s.groupKey === "time"`. Sent in payload; if Service has null category (as in seed), this is false; bot still suppresses zone by name check.

### Can the payload distinguish the three cases?

| Case | service.name (from DB) | service.zone | Bot behavior |
|------|------------------------|-------------|--------------|
| **ELECTRO time** | "Electro 120 min" | "120 минут" or from catalog | Name starts with "electro" → zone line suppressed; card shows service + duration. |
| **ELECTRO display zone** | (Should not appear; if it did) "Голени" | (from catalog if any) | Not bookable; should not be in normal booking payload. |
| **LASER/WAX (zone)** | "Laser 20 min" | "Голени" (from CatalogItem) | Zone line shown; card shows service + zone + duration. |

So the payload distinguishes ELECTRO time vs LASER/WAX by **Service.name** (and optionally `isElectroTimePackage`). It does **not** send `category` or `groupKey`; the bot relies on name (and optionally `isElectroTimePackage`) for ELECTRO.

---

## 8. Risk analysis

Places where the architecture could mix display-only electro zones, bookable electro time, zone labels, or duration labels:

| Risk | Where | Mitigation in current code |
|------|--------|----------------------------|
| **Electro zone Service used for booking** | Booking.serviceId set to zone Service id | `assertElectroServiceBookable` in setService and availability; electro zone Services have `isBookable: false`. |
| **Catalog shows electro zones as bookable** | Grouped catalog includes ELECTRO zone Services in sections | Bot only shows ELECTRO from sections.time (CatalogItems), not zone sections. |
| **Wrong Service.name in DB** | Service.name = "120 минут" or "Голени" for a bookable row | No seed creates this; would cause wrong "Услуга" and possibly zone line. Bot infers ELECTRO only by name prefix. |
| **Payload zone from catalog** | zone = first CatalogItem.titleRu per service | For ELECTRO time, first item can be "120 минут" → backend also sets zone when missing; bot hides zone for ELECTRO by name. |
| **Seed bookable services without category** | Electro time Services have category=null | They still pass `whereBookableService()` and `assertElectroServiceBookable`. `isElectroTimePackage` is false unless category/groupKey set. |
| **Old bookings linked to wrong service** | Legacy Booking.serviceId pointing to zone or bad Service | Would show wrong name/zone in card; no automatic fix in code. |
| **Formatter assumes Service.name pattern** | formatServiceNameOnly expects "Electro…", "Laser…", etc. | If Service.name is Russian or "120 минут", procedure line shows that raw. |
| **Telegram services list** | GET /telegram/services | Uses `whereBookableService()` only; electro zone Services excluded. |

---

## 9. Final plain-language explanation

### 1. What is the difference between ELECTRO “zones” and ELECTRO “services” in this project?

- **ELECTRO “zones”** are informational: body areas (e.g. Голени, Верхняя губа) shown in the electro table on the website. They are stored as **Service** rows with Russian `name`, `category: ELECTRO`, `groupKey` face/body/intimate, and **are not bookable** (`isBookable: false`, `showInBot: false`).
- **ELECTRO “services”** (bookable) are **time packages**: “Electro 15 min”, …, “Electro 120 min”. They are **Service** rows (from main seed) and are what the client actually books. Catalog shows them as “15 минут”, “120 минут” etc. via **CatalogItem** OFFER with `groupKey: "time"` linked to those Services.

### 2. Which table/entity should be the source of truth for bot booking?

**Service** is the source of truth for booking. Every booking stores `Booking.serviceId` → Service. The bot should only ever send **Service.id** when setting or creating a booking. Catalog is for display and selection; when the user picks an option, the bot resolves it to **CatalogItem.serviceId** → **Service.id** and uses that.

### 3. Why do LASER and WAX work differently?

LASER and WAX are sold **by zone** (e.g. “Голени”, “Подмышки”). Each zone is a catalog position linked to a Service (by duration). There is no separate “display-only” Service table for zones—the same Service is used for both catalog and booking. ELECTRO is sold **by time**; zones are only for the website table, so the project has two kinds of ELECTRO entities: bookable time Services and non-bookable zone Services.

### 4. What data should the Telegram bot receive for a correct booking card?

For each booking the bot should receive at least:

- **service.name** = internal Service name (e.g. "Electro 120 min", "Laser 20 min").
- **service.zone** = optional; Russian zone from catalog when relevant (for LASER/WAX); for ELECTRO time the bot should hide it (using name or `isElectroTimePackage`).
- **service.durationMin** = duration in minutes.
- **service.isElectroTimePackage** = optional but useful so the bot can hide the zone line without relying only on `name.startsWith("electro")`.

Category/groupKey are not sent but can be inferred from name (and isElectroTimePackage) for display rules.

### 5. What kinds of bad data/configuration would cause the bot to show wrong service text?

- **Service.name** containing a Russian zone ("Голени") or a duration label ("120 минут") for a **bookable** Service → "Услуга" line shows that text; if zone is also set, duplicate or confusing "Зона" line.
- **Booking.serviceId** pointing to an ELECTRO **zone** Service (display-only) → card would show that zone as service name; such bookings are blocked by guard but could exist from legacy/bugs.
- **Missing or wrong CatalogItem linkage** → zone might be wrong or missing; for ELECTRO time the backend fills zone with "N минут" when no catalog zone; bot still hides zone by ELECTRO detection.
- **Stale or inconsistent Service rows** (e.g. bookable Service updated to have Russian name, or category/groupKey changed) → same payload/formatter issues as above.

---

*This report is diagnostic only. No code, database, or configuration was modified.*
