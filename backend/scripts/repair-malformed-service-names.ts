/**
 * PRODUCTION-SAFE DATA FIX
 * Renames malformed bookable Service rows so Telegram booking cards render correctly.
 *
 * Source: telegram-bot/BOOKING_SERVICE_DATA_DIAGNOSTIC_REPORT.md
 * - ELECTRO: "60/90/120 минут" → "Electro 60/90/120 min"
 * - LASER/WAX (only rows with bookings): Russian zone name → "Laser N min" / "Waxing N min"
 *
 * Does NOT: change Booking rows, touch display-only ELECTRO zones, or modify schema.
 * Usage: npx ts-node scripts/repair-malformed-service-names.ts [dry-run|apply]
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// ── Explicit malformed Service ids from diagnostic report ───────────────────

/** ELECTRO: duration label → internal name (report Section 2.1) */
const ELECTRO_FIX: Record<string, string> = {
  "ee12e08a-863b-4018-85d0-4d37e3c9dba3": "Electro 120 min",
  "933c04e8-5327-454b-be80-6074317fabab": "Electro 60 min",
  "065b401c-98ae-4fba-806c-45a107abacbd": "Electro 90 min",
}

/** LASER/WAX: Service ids that have bookings and Russian name (report Section 3.4). New name derived from category + durationMin. */
const LASER_WAX_IDS_WITH_BOOKINGS = [
  "ebb6ce3a-aab9-4d0d-bb50-3ff4fb11ed3e", // Голени LASER
  "e7e5d8de-8e86-4b94-9a23-abaa21ce2361", // Голени WAX
  "d5c2827a-349e-41ef-8a95-013cad25e310", // Интимная зона (мужская) LASER
  "8ee70369-2c4f-44f5-9d4e-076bf3f0b8c2", // Ягодицы LASER
  "00093d15-b02f-4788-9a18-26518c35a3aa", // Живот полностью WAX
  "be66a7a4-3c50-42d5-a077-a220ff3d30b5", // Ноги полностью WAX
  "6da2705a-abc3-478d-80ec-5ead658c6c8d", // Спина полностью WAX
]

// Same logic as seedCatalogItems.ts for consistency
function laserServiceName(durationMin: number): string {
  if (durationMin <= 15) return "Laser 15 min"
  if (durationMin <= 30) return "Laser 30 min"
  if (durationMin <= 45) return "Laser 45 min"
  if (durationMin <= 60) return "Laser 60 min"
  if (durationMin <= 90) return "Laser 90 min"
  return "Laser 120 min"
}

function waxServiceName(durationMin: number): string {
  if (durationMin <= 15) return "Waxing 15 min"
  if (durationMin <= 25) return "Waxing 25 min"
  if (durationMin <= 35) return "Waxing 35 min"
  if (durationMin <= 50) return "Waxing 50 min"
  return "Waxing 60 min"
}

type Mode = "dry-run" | "apply"

async function main() {
  const mode = (process.argv[2] ?? "dry-run").toLowerCase() as Mode
  if (mode !== "dry-run" && mode !== "apply") {
    console.error("Usage: npx ts-node scripts/repair-malformed-service-names.ts [dry-run|apply]")
    process.exit(1)
  }

  console.log("=== Repair malformed Service names ===\n")
  console.log("Mode:", mode)
  console.log("Booking.serviceId will NOT be changed.\n")

  const updates: { id: string; oldName: string; newName: string; category?: string }[] = []

  // 1) ELECTRO duration-label fixes
  for (const [id, newName] of Object.entries(ELECTRO_FIX)) {
    const row = await prisma.service.findUnique({
      where: { id },
      select: { id: true, name: true, category: true, groupKey: true },
    })
    if (!row) {
      console.warn("Service not found:", id)
      continue
    }
    if (row.name === newName) {
      console.log("Skip (already correct):", id, row.name)
      continue
    }
    updates.push({ id, oldName: row.name, newName })
  }

  // 2) LASER/WAX Russian-name fixes (only ids with bookings)
  for (const id of LASER_WAX_IDS_WITH_BOOKINGS) {
    const row = await prisma.service.findUnique({
      where: { id },
      select: { id: true, name: true, category: true, durationMin: true },
    })
    if (!row) {
      console.warn("Service not found:", id)
      continue
    }
    const category = row.category
    const durationMin = row.durationMin
    const newName =
      category === "LASER"
        ? laserServiceName(durationMin)
        : category === "WAX"
          ? waxServiceName(durationMin)
          : null
    if (!newName) {
      console.warn("Skip (not LASER/WAX):", id, category)
      continue
    }
    if (row.name === newName) {
      console.log("Skip (already correct):", id, row.name)
      continue
    }
    updates.push({ id, oldName: row.name, newName, category: category ?? undefined })
  }

  console.log("--- Planned updates ---\n")
  for (const u of updates) {
    console.log(`  ${u.id}`)
    console.log(`    "${u.oldName}" → "${u.newName}"${u.category ? ` (${u.category})` : ""}`)
  }
  console.log("")

  if (mode === "dry-run") {
    console.log("Dry-run complete. Run with 'apply' to persist.")
    return
  }

  let applied = 0
  for (const u of updates) {
    await prisma.service.update({
      where: { id: u.id },
      data: { name: u.newName },
    })
    applied++
    console.log("Updated:", u.id, "→", u.newName)
  }
  console.log("\nApplied", applied, "updates.")
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
