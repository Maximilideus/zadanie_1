/**
 * PRODUCTION-SAFE DATA ROLLBACK
 * Reverts Service.name for the 10 exact Service ids changed by repair-malformed-service-names.ts.
 * Only Service.name is updated. No other fields or relations are touched.
 *
 * Usage: npx ts-node scripts/rollback-service-name-repair.ts [dry-run|apply]
 * Default: dry-run
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/** Exact rollback map: id -> target name (original business-facing form). */
const ROLLBACK_MAP: Record<string, string> = {
  // ELECTRO
  "ee12e08a-863b-4018-85d0-4d37e3c9dba3": "120 минут",
  "933c04e8-5327-454b-be80-6074317fabab": "60 минут",
  "065b401c-98ae-4fba-806c-45a107abacbd": "90 минут",
  // LASER
  "ebb6ce3a-aab9-4d0d-bb50-3ff4fb11ed3e": "Голени",
  "d5c2827a-349e-41ef-8a95-013cad25e310": "Интимная зона (мужская)",
  "8ee70369-2c4f-44f5-9d4e-076bf3f0b8c2": "Ягодицы",
  "00093d15-b02f-4788-9a18-26518c35a3aa": "Голени",
  // WAX
  "e7e5d8de-8e86-4b94-9a23-abaa21ce2361": "Голени",
  "be66a7a4-3c50-42d5-a077-a220ff3d30b5": "Ноги полностью",
  "6da2705a-abc3-478d-80ec-5ead658c6c8d": "Спина полностью",
}

type Mode = "dry-run" | "apply"

async function main() {
  const arg = (process.argv[2] ?? "dry-run").toLowerCase()
  const mode: Mode = arg === "apply" ? "apply" : "dry-run"

  console.log("=== Rollback Service.name repair ===\n")
  console.log("Mode:", mode)
  console.log("Only Service.name is updated. Only the exact", Object.keys(ROLLBACK_MAP).length, "ids below.\n")

  const ids = Object.keys(ROLLBACK_MAP)
  const rows = await prisma.service.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  })
  const byId = new Map(rows.map((r) => [r.id, r]))

  const toUpdate: { id: string; currentName: string; targetName: string }[] = []
  for (const id of ids) {
    const targetName = ROLLBACK_MAP[id]
    const row = byId.get(id)
    const currentName = row?.name ?? "(not found)"
    if (currentName !== targetName) toUpdate.push({ id, currentName, targetName })
  }

  console.log("--- Planned changes ---\n")
  for (const id of ids) {
    const targetName = ROLLBACK_MAP[id]
    const row = byId.get(id)
    const currentName = row?.name ?? "(not found)"
    const needed = currentName !== targetName
    console.log(`  ${id}`)
    console.log(`    current: "${currentName}"`)
    console.log(`    target:  "${targetName}"`)
    console.log(`    change needed: ${needed}`)
    console.log("")
  }

  if (toUpdate.length === 0) {
    console.log("No updates needed (all names already match target).")
    return
  }

  if (mode === "dry-run") {
    console.log("Dry-run complete. Run with 'apply' to persist.")
    return
  }

  let applied = 0
  for (const u of toUpdate) {
    await prisma.service.update({
      where: { id: u.id },
      data: { name: u.targetName },
    })
    applied++
    console.log("Updated:", u.id, `"${u.currentName}" -> "${u.targetName}"`)
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
