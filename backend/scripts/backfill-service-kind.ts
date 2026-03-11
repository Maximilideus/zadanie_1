/**
 * Backfill Service.serviceKind for legacy template services.
 *
 * Legacy template services are the English-named time-based rows that were
 * used historically by the bot (e.g. "Electro 15 min", "Laser 60 min").
 * They have no category, no gender, and no sourceCatalogItemId.
 *
 * Modes: dry-run | apply | verify
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

type Mode = "dry-run" | "apply" | "verify"

const LEGACY_TEMPLATE_NAMES = new Set([
  "Electro 15 min",
  "Electro 30 min",
  "Electro 45 min",
  "Electro 60 min",
  "Electro 90 min",
  "Electro 120 min",
  "Laser 15 min",
  "Laser 30 min",
  "Laser 45 min",
  "Laser 60 min",
  "Laser 90 min",
  "Laser 120 min",
  "Waxing 15 min",
  "Waxing 25 min",
  "Waxing 35 min",
  "Waxing 50 min",
  "Waxing 60 min",
  "Massage Classic 60 min",
  "Massage Lymph 60 min",
  "Massage Relax 60 min",
  "Massage Sport 60 min",
])

function isLegacyTemplate(name: string, category: string | null): boolean {
  return LEGACY_TEMPLATE_NAMES.has(name) && category === null
}

async function runDryRun() {
  const services = await prisma.service.findMany({
    select: { id: true, name: true, category: true, serviceKind: true },
  })

  let toMark = 0
  let alreadyMarked = 0
  let business = 0

  for (const svc of services) {
    if (isLegacyTemplate(svc.name, svc.category)) {
      if (svc.serviceKind === "LEGACY_TEMPLATE") {
        alreadyMarked++
      } else {
        toMark++
        console.log(`  [to-mark] "${svc.name}" → LEGACY_TEMPLATE`)
      }
    } else {
      business++
    }
  }

  console.log("[backfill-service-kind] dry-run:")
  console.log(`  Total services:         ${services.length}`)
  console.log(`  BUSINESS:               ${business}`)
  console.log(`  To mark LEGACY_TEMPLATE: ${toMark}`)
  console.log(`  Already LEGACY_TEMPLATE: ${alreadyMarked}`)
}

async function runApply() {
  const services = await prisma.service.findMany({
    select: { id: true, name: true, category: true, serviceKind: true },
  })

  let updated = 0
  let skipped = 0

  for (const svc of services) {
    if (isLegacyTemplate(svc.name, svc.category) && svc.serviceKind !== "LEGACY_TEMPLATE") {
      await prisma.service.update({
        where: { id: svc.id },
        data: { serviceKind: "LEGACY_TEMPLATE" },
      })
      updated++
    } else {
      skipped++
    }
  }

  console.log("[backfill-service-kind] apply done:")
  console.log(`  Updated:  ${updated}`)
  console.log(`  Skipped:  ${skipped}`)
}

async function runVerify() {
  const services = await prisma.service.findMany({
    select: { id: true, name: true, category: true, serviceKind: true },
  })

  let ok = true
  let businessCount = 0
  let legacyCount = 0

  for (const svc of services) {
    const shouldBeLegacy = isLegacyTemplate(svc.name, svc.category)
    if (shouldBeLegacy && svc.serviceKind !== "LEGACY_TEMPLATE") {
      console.error(`  [FAIL] "${svc.name}" should be LEGACY_TEMPLATE but is ${svc.serviceKind}`)
      ok = false
    } else if (!shouldBeLegacy && svc.serviceKind !== "BUSINESS") {
      console.error(`  [FAIL] "${svc.name}" should be BUSINESS but is ${svc.serviceKind}`)
      ok = false
    }
    if (svc.serviceKind === "LEGACY_TEMPLATE") legacyCount++
    else businessCount++
  }

  console.log("[backfill-service-kind] verify:")
  console.log(`  BUSINESS:         ${businessCount}`)
  console.log(`  LEGACY_TEMPLATE:  ${legacyCount}`)
  console.log(ok ? "\n  ✓ VERIFY PASSED" : "\n  ✗ VERIFY FAILED")
  if (!ok) process.exitCode = 1
}

async function main() {
  const mode = (process.argv[2] || "dry-run").toLowerCase() as Mode
  if (!["dry-run", "apply", "verify"].includes(mode)) {
    console.error("Usage: ts-node scripts/backfill-service-kind.ts [dry-run|apply|verify]")
    process.exit(1)
  }
  if (mode === "dry-run") await runDryRun()
  else if (mode === "apply") await runApply()
  else await runVerify()
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
