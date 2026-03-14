# Data-Grounded Diagnostic Report: Incorrect Service Text in Telegram Booking Messages

**Rules observed:** No code, database, or migrations modified. Diagnostic only.

---

## SECTION 1 — Diagnostic rules (what counts as suspicious / wrong)

The following rules are used to flag **suspicious** Service rows and **wrong** Booking → Service links.

### A. Bookable ELECTRO services

- **Acceptable** internal names: `"Electro 15 min"`, `"Electro 30 min"`, `"Electro 60 min"`, `"Electro 120 min"` (English + duration).
- **Wrong** for bookable ELECTRO: `Service.name` = duration label in Russian (e.g. `"120 минут"`, `"60 минут"`) or any zone label.

### B. ELECTRO display-only zone rows

- Rows with `category = ELECTRO`, `groupKey` in `face` / `body` / `intimate`, `isBookable = false`, `showInBot = false` (e.g. "Голени", "Подмышки") are **display-only**.
- **Rule:** No Booking must reference these Services (`booking.serviceId` must not point to them).

### C. Suspicious Service rows (any of the following)

1. **Service.name in Russian** when the row is used as bookable service identity (e.g. "Голени", "Ягодицы", "Спина полностью") — causes "📋 Услуга: Голени" etc.
2. **Service.name = zone label** (e.g. "Голени", "Подмышки") — same effect.
3. **Service.name = duration label** (e.g. "120 минут", "60 минут") — causes "📋 Услуга: 120 минут" and, if zone is also set, "📍 Зона: 120 минут".
4. **ELECTRO** rows with inconsistent semantics: e.g. `category = ELECTRO`, `groupKey != "time"`, but `isBookable = true`; or ELECTRO time services with non-internal name.
5. **Any Booking** linked to a Service that is `isBookable = false` or `showInBot = false` (except where business explicitly allows).

### D. Classification used below

- **Valid bookable service** — Internal name (e.g. "Laser 20 min", "Electro 120 min"), intended for booking.
- **Display-only site entity** — ELECTRO zone rows; must not be linked from Booking.
- **Malformed bookable service** — Bookable but `Service.name` is Russian zone/duration label; causes wrong Telegram text.
- **Legacy / bad data** — Same as malformed or Booking → wrong Service link.

---

## SECTION 2 — Inventory of suspicious Service rows

**Source:** Database query (read-only script `diagnostic-booking-service-integrity.ts`).

**Totals:**

- **Total Service rows:** 111  
- **Suspicious Service rows:** 85  

### 2.1 Services with **name = duration label** (e.g. "120 минут", "60 минут")

These directly cause Telegram messages like "📋 Услуга: 120 минут", "📍 Зона: 120 минут".

| id | name | category | groupKey | durationMin | isBookable | showInBot |
|----|------|----------|----------|-------------|------------|-----------|
| `ee12e08a-863b-4018-85d0-4d37e3c9dba3` | **"120 минут"** | ELECTRO | time | 120 | true | true |
| `933c04e8-5327-454b-be80-6074317fabab` | **"60 минут"** | ELECTRO | time | 60 | true | true |
| `065b401c-98ae-4fba-806c-45a107abacbd` | **"90 минут"** | ELECTRO | time | 90 | true | true |

*(Other ELECTRO time services may exist with "15 минут", "30 минут", "45 минут" — same pattern.)*

**Reason:** `name_like_duration_label` — bookable ELECTRO should have internal name "Electro 120 min", not "120 минут".

---

### 2.2 Services with **name = Russian zone label** (LASER / WAX), bookable

These cause "📋 Услуга: Голени", "📍 Зона: Голени" (or zone from catalog). All have `isBookable: true`, `showInBot: true`.

**LASER (examples):**  
`Голени` (2 rows, durationMin 20 and 25), `Ягодицы`, `Бёдра`, `Бикини глубокое`, `Бикини классическое`, `Борода (контур / шея)`, `Верхняя губа`, `Грудь`, `Живот`, `Живот (линия)`, `Живот полностью`, `Интимная зона (мужская)`, `Лицо полностью`, `Ноги полностью` (2), `Плечи`, `Подбородок`, `Подмышки` (2), `Предплечья`, `Руки полностью` (2), `Спина полностью` (2), `Тотальное бикини`, `Щёки и скулы`.

**WAX (examples):**  
Same zone names, category WAX, various durationMin (e.g. `Голени` 20/30, `Подмышки` 10/15, etc.).

**Reason:** `name_russian_zone` — intended convention is internal name (e.g. "Laser 20 min") with zone in CatalogItem.titleRu; here Service.name holds the zone label.

---

### 2.3 ELECTRO display-only zone rows (not bookable)

All with `category: ELECTRO`, `groupKey` in `face`/`body`/`intimate`, `isBookable: false`, `showInBot: false`, `durationMin: 0`, `name` in Russian (e.g. "Ареолы", "Бёдра", "Голени", "Подмышки", "Верхняя губа", "Ноги полностью", "Ягодицы", …).

**Reason:** `electro_display_only_zone`, `not_bookable`, `show_in_bot_false`. These must never be linked from Booking.

**Count:** 24 such ELECTRO zone Services (no Booking linked in current data).

---

## SECTION 3 — Bookings linked to suspicious Services

**Total Bookings linked to suspicious Services:** 15  

Grouped by suspicious Service.

### 3.1 Bookings → Service **"120 минут"** (id `ee12e08a-863b-4018-85d0-4d37e3c9dba3`)

| booking.id | createdAt | status | source | customerId |
|------------|-----------|--------|--------|------------|
| `1ceae005-7bed-4321-b1c2-823ad2652740` | 2026-03-14 15:08:48 | CANCELLED | BOT | c4b1fc5b-… |
| `a0c7b5d9-ed22-4abc-a017-cf2225e6f638` | 2026-03-14 15:07:36 | CANCELLED | BOT | c4b1fc5b-… |
| `5683f435-0991-40dd-ac50-8ce629391059` | 2026-03-14 12:53:18 | CANCELLED | BOT | c4b1fc5b-… |
| `6b7b5dd9-b009-4618-abc7-0c19a176509d` | 2026-03-14 12:31:16 | CANCELLED | BOT | c4b1fc5b-… |

**Effect:** Telegram would show "📋 Услуга: 120 минут", "📍 Зона: 120 минут" (if zone present), "⏱ Длительность: 120 мин".

---

### 3.2 Bookings → Service **"60 минут"** (id `933c04e8-5327-454b-be80-6074317fabab`)

| booking.id | createdAt | status | source | customerId |
|------------|-----------|--------|--------|------------|
| `3a82cb37-4894-4c17-93e9-d58bae3e988d` | 2026-03-14 14:31:58 | CANCELLED | BOT | c4b1fc5b-… |
| `7b5223a6-e639-4415-84a3-8b6bf8b30f03` | 2026-03-14 12:48:07 | CANCELLED | BOT | c4b1fc5b-… |

---

### 3.3 Bookings → Service **"90 минут"** (id `065b401c-98ae-4fba-806c-45a107abacbd`)

| booking.id | createdAt | status | source | customerId |
|------------|-----------|--------|--------|------------|
| `735d1c1a-0c55-4a1a-b0e5-ba5ad49fc602` | 2026-03-14 12:46:41 | CANCELLED | BOT | c4b1fc5b-… |

---

### 3.4 Bookings → LASER/WAX Services with Russian name

| Service name | serviceId | booking.id | status |
|--------------|-----------|------------|--------|
| Голени (LASER) | ebb6ce3a-aab9-4d0d-bb50-3ff4fb11ed3e | 7a741a26-a90b-461c-be08-e5f7b86205b0 | CANCELLED |
| Голени (WAX) | e7e5d8de-8e86-4b94-9a23-abaa21ce2361 | a9c762b1-6690-4d84-907e-5ffefa9f1b80 | CANCELLED |
| Интимная зона (мужская) (LASER) | d5c2827a-349e-41ef-8a95-013cad25e310 | 406cde49-80e4-49a7-ae87-e4ad46daa191 | CANCELLED |
| Ягодицы (LASER) | 8ee70369-2c4f-44f5-9d4e-076bf3f0b8c2 | d3287fa8-c2ad-4588-b79a-4d3eb9fc3374 | **PENDING** |
| Живот полностью (WAX) | 00093d15-b02f-4788-9a18-26518c35a3aa | b7888414-191b-45b4-8ddf-5813cbdf29f9 | CANCELLED |
| Ноги полностью (WAX) | be66a7a4-3c50-42d5-a077-a220ff3d30b5 | 11c21f79-c421-4b11-8d97-09bed03b770d | COMPLETED |
| Спина полностью (WAX) | 6da2705a-abc3-478d-80ec-5ead658c6c8d | e5099e97-619a-4cb4-9035-0e96fd702fee | CANCELLED |
| Спина полностью (WAX) | 6da2705a-abc3-478d-80ec-5ead658c6c8d | 23f14e96-ac93-43e9-9eb5-54ed11e82f1f | CANCELLED |

**Effect:** Telegram shows "📋 Услуга: Голени" (or Ягодицы, Спина полностью, etc.) and "📍 Зона: …" from catalog if present.

---

**Summary:**  
- **7 Bookings** linked to ELECTRO services named "120 минут" / "60 минут" / "90 минут" → wrong duration-label text.  
- **8 Bookings** linked to LASER/WAX services with Russian zone names → wrong zone-as-service text.  
- **0 Bookings** linked to ELECTRO display-only zone Services (all such Services have 0 bookings).

---

## SECTION 4 — Classification of each problematic Service type

| Type | Classification | Should be linked from Booking? | Safe for Telegram? |
|------|----------------|--------------------------------|--------------------|
| **ELECTRO "120 минут" / "60 минут" / "90 минут"** | **Malformed bookable service** | Yes (conceptually the right product) | **No** — name is a duration label; Telegram shows "Услуга: 120 минут", "Зона: 120 минут". |
| **LASER/WAX with Russian zone name** (e.g. Голени, Ягодицы) | **Malformed bookable service** or **legacy** | Yes (zone-based product) | **No** — Telegram shows "Услуга: Голени" etc.; zone line may duplicate or confuse. |
| **ELECTRO display-only** (e.g. Голени, Ареолы, category ELECTRO, groupKey face/body/intimate, isBookable false) | **Display-only site entity** | **No** | N/A — must not be linked; currently none linked. |

**Explanation:**

- **Duration-label ELECTRO:** Correct semantics (time-based, bookable) but wrong `Service.name`. Backend and bot use `service.name` for the "Услуга" line; so rendering is wrong until the row is renamed (e.g. to "Electro 120 min") or Booking is re-linked to a correctly named Service.
- **Russian-name LASER/WAX:** Same: product is bookable, but `Service.name` is the zone label. Rendering is wrong; either Service names should be internal (e.g. "Laser 20 min") with zone from CatalogItem, or the formatter would need to treat these names differently (no code change in this diagnostic).
- **ELECTRO display-only:** Correctly not linked; if any Booking pointed here, it would be "bad Booking → Service link".

---

## SECTION 5 — Root-cause patterns (with affected ids)

### Pattern 1: Bookable ELECTRO services with duration label in `Service.name`

- **Cause:** Service rows created or updated with `name = "120 минут"` (or "60", "90" etc.) instead of "Electro 120 min".
- **Affected Service ids:**  
  `ee12e08a-863b-4018-85d0-4d37e3c9dba3` ("120 минут"),  
  `933c04e8-5327-454b-be80-6074317fabab` ("60 минут"),  
  `065b401c-98ae-4fba-806c-45a107abacbd` ("90 минут").
- **Affected Booking ids:**  
  `1ceae005-7bed-4321-b1c2-823ad2652740`, `a0c7b5d9-ed22-4abc-a017-cf2225e6f638`, `5683f435-0991-40dd-ac50-8ce629391059`, `6b7b5dd9-b009-4618-abc7-0c19a176509d`,  
  `3a82cb37-4894-4c17-93e9-d58bae3e988d`, `7b5223a6-e639-4415-84a3-8b6bf8b30f03`,  
  `735d1c1a-0c55-4a1a-b0e5-ba5ad49fc602`.

---

### Pattern 2: Bookable LASER/WAX services with Russian zone name in `Service.name`

- **Cause:** Service rows use zone label (e.g. "Голени", "Ягодицы") as `name` instead of internal (e.g. "Laser 20 min"); possibly different seed/migration or admin data.
- **Affected:** Multiple LASER and WAX Service ids (see Section 2.2); at least 8 Bookings linked to them (Section 3.4).
- **Affected Booking ids:**  
  `7a741a26-a90b-461c-be08-e5f7b86205b0`, `a9c762b1-6690-4d84-907e-5ffefa9f1b80`,  
  `406cde49-80e4-49a7-ae87-e4ad46daa191`, `d3287fa8-c2ad-4588-b79a-4d3eb9fc3374`,  
  `b7888414-191b-45b4-8ddf-5813cbdf29f9`, `11c21f79-c421-4b11-8d97-09bed03b770d`,  
  `e5099e97-619a-4cb4-9035-0e96fd702fee`, `23f14e96-ac93-43e9-9eb5-54ed11e82f1f`.

---

### Pattern 3: Mixed naming conventions

- **Cause:** DB contains both (a) internal names (e.g. "Electro 120 min", "Laser 20 min") and (b) Russian/duration names ("120 минут", "Голени"). Bookings reference (b), so Telegram shows wrong text.
- **Observation:** 85 suspicious vs 26 non-suspicious Service rows; many bookable rows use (b).

---

### Pattern 4: ELECTRO display-only zones

- **Cause:** ELECTRO zone Services (name "Голени", etc., isBookable false) exist for the website.
- **Status:** **No** Booking is linked to them in current data; no fix needed for links, but any future link would be wrong.

---

## SECTION 6 — Is the problem only ELECTRO or also LASER/WAX/MASSAGE?

**Answer: The problem is NOT only ELECTRO. It also affects LASER and WAX.**

- **ELECTRO:** Wrong text from **duration-label names** ("120 минут", "60 минут", "90 минут") — 7 Bookings.
- **LASER / WAX:** Wrong text from **Russian zone names** in `Service.name` — 8 Bookings (e.g. "Голени", "Ягодицы", "Спина полностью", "Ноги полностью", "Живот полностью", "Интимная зона (мужская)").

**MASSAGE:** No Booking in the diagnostic output was linked to a suspicious Service; MASSAGE may use internal-style names only in this dataset.

**Concrete list of Bookings with wrong-style Service name (LASER/WAX):**

- d3287fa8-c2ad-4588-b79a-4d3eb9fc3374 — Ягодицы (LASER), PENDING  
- 23f14e96-ac93-43e9-9eb5-54ed11e82f1f — Спина полностью (WAX)  
- e5099e97-619a-4cb4-9035-0e96fd702fee — Спина полностью (WAX)  
- a9c762b1-6690-4d84-907e-5ffefa9f1b80 — Голени (WAX)  
- 11c21f79-c421-4b11-8d97-09bed03b770d — Ноги полностью (WAX), COMPLETED  
- 406cde49-80e4-49a7-ae87-e4ad46daa191 — Интимная зона (мужская) (LASER)  
- b7888414-191b-45b4-8ddf-5813cbdf29f9 — Живот полностью (WAX)  
- 7a741a26-a90b-461c-be08-e5f7b86205b0 — Голени (LASER)  

---

## SECTION 7 — Good vs bad examples (from current data)

### A. Correct Service row used safely by Booking

**Example:** A Service with internal name (e.g. "Electro 120 min", "Laser 20 min") and `category`/`groupKey` consistent with use.  
In the current DB, **26 Service rows** are non-suspicious (no Russian in name, no duration label, no ELECTRO display-only). Any **Booking** that references one of these would show correct Telegram text (e.g. "📋 Услуга: Электроэпиляция", "⏱ Длительность: 120 мин", no zone for ELECTRO).  
**Note:** The diagnostic script did not find any Booking linked to such a Service in the sample; all 15 Bookings linked to suspicious Services point to either duration-label ELECTRO or Russian-name LASER/WAX.

**What Telegram would show:**  
"📋 Услуга: Электроэпиляция" (or "Лазерная эпиляция"), "⏱ Длительность: 120 мин", and for LASER/WAX "📍 Зона: Голени" from catalog — correct.

---

### B. Problematic Service row used by Booking

**Example 1 — ELECTRO duration label:**  
Service id `ee12e08a-863b-4018-85d0-4d37e3c9dba3`, name **"120 минут"**, category ELECTRO, groupKey time.  
Bookings: 1ceae005-…, a0c7b5d9-…, 5683f435-…, 6b7b5dd9-….

**What Telegram shows:**  
"📋 Услуга: 120 минут", "📍 Зона: 120 минут" (if backend sends zone), "⏱ Длительность: 120 мин" — wrong service line and zone line.

**Example 2 — LASER zone name:**  
Service id `8ee70369-2c4f-44f5-9d4e-076bf3f0b8c2`, name **"Ягодицы"**, category LASER, groupKey body.  
Booking: d3287fa8-c2ad-4588-b79a-4d3eb9fc3374 (PENDING).

**What Telegram shows:**  
"📋 Услуга: Ягодицы", "📍 Зона: …" (from catalog) — service line shows zone label instead of procedure type.

---

### C. Display-only row that should never be used by Booking

**Example:** Service id `a7785137-bc20-437a-abdd-181c11f4414e`, name **"Ареолы"**, category ELECTRO, groupKey body, **isBookable: false**, **showInBot: false**, durationMin 0.

**Should be linked from Booking?** No.  
**Linked bookings in data:** 0.  
If a Booking pointed here, Telegram would show "📋 Услуга: Ареолы" and no duration — wrong and misleading.

---

## SECTION 8 — Final conclusion

### 1. Which exact Service rows cause wrong Telegram rendering?

- **ELECTRO duration-label names (3 confirmed):**  
  `ee12e08a-863b-4018-85d0-4d37e3c9dba3` ("120 минут"),  
  `933c04e8-5327-454b-be80-6074317fabab` ("60 минут"),  
  `065b401c-98ae-4fba-806c-45a107abacbd` ("90 минут").  
  Any other ELECTRO time Service with `name` like "15 минут", "30 минут", "45 минут" would have the same effect.

- **LASER/WAX with Russian zone name (many):** All 58+ LASER/WAX Services whose `name` is a Russian zone (Голени, Ягодицы, Спина полностью, etc.) cause "Услуга: <zone>" when a Booking references them. Specific examples with bookings:  
  ebb6ce3a-aab9-4d0d-bb50-3ff4fb11ed3e, e7e5d8de-8e86-4b94-9a23-abaa21ce2361, d5c2827a-349e-41ef-8a95-013cad25e310, 8ee70369-2c4f-44f5-9d4e-076bf3f0b8c2, 00093d15-b02f-4788-9a18-26518c35a3aa, be66a7a4-3c50-42d5-a077-a220ff3d30b5, 6da2705a-abc3-478d-80ec-5ead658c6c8d.

### 2. Which exact Booking rows are linked to them?

- **15 Booking rows** in total (see Section 3).  
- **7** linked to ELECTRO "120/60/90 минут" Services.  
- **8** linked to LASER/WAX Services with Russian names.  
- One of these is **PENDING** (d3287fa8-c2ad-4588-b79a-4d3eb9fc3374 → "Ягодицы"); the rest are CANCELLED or COMPLETED.

### 3. Is the issue only ELECTRO or also other categories?

**Both ELECTRO and LASER/WAX.** ELECTRO: duration-label names. LASER/WAX: zone names in `Service.name`. MASSAGE: no such Bookings in this sample.

### 4. Main issue: bad Service rows, bad Booking links, legacy, or multiple conventions?

- **Primary: bad Service rows** — Bookable Services have `name` set to display/duration labels ("120 минут", "Голени") instead of internal names ("Electro 120 min", "Laser 20 min").
- **Secondary: multiple naming conventions** — DB has both internal-name and Russian/duration-name rows; bookings reference the latter.
- **Booking → Service links** are consistent with the current data model (each Booking points to one Service); the problem is that the **referenced Service rows** have wrong names, not that links are to the wrong “kind” of entity (except that ELECTRO display-only must never be linked, and currently they are not).

### 5. Safest next fix strategy

**Target both:**

1. **Correct Service rows**  
   - Rename ELECTRO time services from "120 минут" etc. to "Electro 120 min" (and same for 15/30/45/60/90).  
   - For LASER/WAX, either: (a) rename to internal names (e.g. "Laser 20 min") and keep zone only in CatalogItem, or (b) keep Russian names and change formatter/display logic (not in scope of this diagnostic).

2. **Correct Booking links only where necessary**  
   - If duplicate Services exist (e.g. one "Electro 120 min" and one "120 минут"), consider re-linking Bookings from the bad-named Service to the correct-named Service so that existing and future Telegram payloads show the right text.  
   - If there is a 1:1 rename (same id, only name change), then correcting Service rows is enough and Booking links stay as they are.

**Recommendation:** Prefer **correcting Service rows** (rename to internal names) so that existing Booking.serviceId remains valid and Telegram rendering fixes automatically. If re-linking is chosen (e.g. map "120 минут" → "Electro 120 min" by duration and category), then both Service data and Booking links may need to be updated.

---

*This report is diagnostic only. No code or data was modified. Data was collected with the read-only script `backend/scripts/diagnostic-booking-service-integrity.ts`.*
