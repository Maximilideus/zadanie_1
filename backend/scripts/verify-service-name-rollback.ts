/**
 * Prints current Service.name (and category, durationMin) for the 10 ids
 * that are affected by rollback-service-name-repair.ts.
 * Read-only; no updates.
 *
 * Usage: npx ts-node scripts/verify-service-name-rollback.ts
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const IDS = [
  "ee12e08a-863b-4018-85d0-4d37e3c9dba3",
  "933c04e8-5327-454b-be80-6074317fabab",
  "065b401c-98ae-4fba-806c-45a107abacbd",
  "ebb6ce3a-aab9-4d0d-bb50-3ff4fb11ed3e",
  "d5c2827a-349e-41ef-8a95-013cad25e310",
  "8ee70369-2c4f-44f5-9d4e-076bf3f0b8c2",
  "00093d15-b02f-4788-9a18-26518c35a3aa",
  "e7e5d8de-8e86-4b94-9a23-abaa21ce2361",
  "be66a7a4-3c50-42d5-a077-a220ff3d30b5",
  "6da2705a-abc3-478d-80ec-5ead658c6c8d",
]

async function main() {
  const rows = await prisma.service.findMany({
    where: { id: { in: IDS } },
    select: { id: true, name: true, category: true, durationMin: true },
    orderBy: { id: "asc" },
  })
  console.log("--- Current Service rows (rollback set) ---\n")
  for (const r of rows) {
    console.log("id:", r.id)
    console.log("  name:", JSON.stringify(r.name))
    console.log("  category:", r.category)
    console.log("  durationMin:", r.durationMin)
    console.log("")
  }
  if (rows.length !== IDS.length) {
    console.log("Warning: expected", IDS.length, "rows, got", rows.length)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
