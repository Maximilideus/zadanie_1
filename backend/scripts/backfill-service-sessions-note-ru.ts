/**
 * Backfill Service.sessionsNoteRu from CatalogItem.sessionsNoteRu.
 *
 * Match: Service.sourceCatalogItemId -> CatalogItem.id
 *
 * Rules:
 * - Only backfill when Service.sourceCatalogItemId is not null
 * - Only copy when CatalogItem.sessionsNoteRu is not null and not empty
 * - Do NOT overwrite non-empty Service.sessionsNoteRu
 *
 * Modes: dry-run | apply | verify
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

type Mode = "dry-run" | "apply" | "verify"

async function runDryRun() {
  const services = await prisma.service.findMany({
    where: { sourceCatalogItemId: { not: null } },
    select: {
      id: true,
      name: true,
      sourceCatalogItemId: true,
      sessionsNoteRu: true,
    },
  })

  const catalogItems = await prisma.catalogItem.findMany({
    where: {
      id: { in: services.map((s) => s.sourceCatalogItemId!).filter(Boolean) },
      sessionsNoteRu: { not: null },
    },
    select: { id: true, sessionsNoteRu: true },
  })
  const catalogMap = new Map(catalogItems.map((c) => [c.id, c.sessionsNoteRu!]))

  let scanned = services.length
  let copied = 0
  let skipped = 0
  let missingSource = 0
  let alreadySet = 0

  for (const svc of services) {
    const catalogId = svc.sourceCatalogItemId!
    const catalogNote = catalogMap.get(catalogId)

    if (svc.sessionsNoteRu && svc.sessionsNoteRu.trim()) {
      alreadySet++
    } else if (!catalogNote || !catalogNote.trim()) {
      missingSource++
    } else {
      copied++
    }
  }
  skipped = scanned - copied - missingSource - alreadySet
  if (skipped < 0) skipped = 0

  console.log("[backfill-service-sessions-note-ru] dry-run:")
  console.log(`  Scanned:       ${scanned}`)
  console.log(`  To copy:       ${copied}`)
  console.log(`  Already set:   ${alreadySet}`)
  console.log(`  Missing source (CatalogItem has no sessionsNoteRu): ${missingSource}`)
  console.log(`  Skipped:       ${skipped}`)
}

async function runApply() {
  const services = await prisma.service.findMany({
    where: { sourceCatalogItemId: { not: null } },
    select: {
      id: true,
      name: true,
      sourceCatalogItemId: true,
      sessionsNoteRu: true,
    },
  })

  const catalogItems = await prisma.catalogItem.findMany({
    where: {
      id: { in: services.map((s) => s.sourceCatalogItemId!).filter(Boolean) },
      sessionsNoteRu: { not: null },
    },
    select: { id: true, sessionsNoteRu: true },
  })
  const catalogMap = new Map(catalogItems.map((c) => [c.id, c.sessionsNoteRu!]))

  let scanned = services.length
  let copied = 0
  let skipped = 0
  let missingSource = 0
  let alreadySet = 0

  for (const svc of services) {
    const catalogId = svc.sourceCatalogItemId!
    const catalogNote = catalogMap.get(catalogId)

    if (svc.sessionsNoteRu && svc.sessionsNoteRu.trim()) {
      alreadySet++
    } else if (!catalogNote || !catalogNote.trim()) {
      missingSource++
    } else {
      await prisma.service.update({
        where: { id: svc.id },
        data: { sessionsNoteRu: catalogNote.trim() },
      })
      copied++
    }
  }
  skipped = scanned - copied - missingSource - alreadySet
  if (skipped < 0) skipped = 0

  console.log("[backfill-service-sessions-note-ru] apply done:")
  console.log(`  Scanned:       ${scanned}`)
  console.log(`  Copied:        ${copied}`)
  console.log(`  Already set:   ${alreadySet}`)
  console.log(`  Missing source: ${missingSource}`)
  console.log(`  Skipped:       ${skipped}`)
}

async function runVerify() {
  const services = await prisma.service.findMany({
    where: { sourceCatalogItemId: { not: null } },
    select: {
      id: true,
      name: true,
      sourceCatalogItemId: true,
      sessionsNoteRu: true,
    },
  })

  const catalogItems = await prisma.catalogItem.findMany({
    where: {
      id: { in: services.map((s) => s.sourceCatalogItemId!).filter(Boolean) },
      sessionsNoteRu: { not: null },
    },
    select: { id: true, sessionsNoteRu: true },
  })
  const catalogMap = new Map(catalogItems.map((c) => [c.id, c.sessionsNoteRu!]))

  let ok = true
  let withNote = 0
  let withoutNote = 0
  const missing: string[] = []

  for (const svc of services) {
    const catalogId = svc.sourceCatalogItemId!
    const catalogNote = catalogMap.get(catalogId)

    if (svc.sessionsNoteRu && svc.sessionsNoteRu.trim()) {
      withNote++
    } else if (catalogNote && catalogNote.trim()) {
      withoutNote++
      missing.push(`"${svc.name}" (id=${svc.id}) — CatalogItem has "${catalogNote}"`)
      ok = false
    } else {
      withoutNote++
    }
  }

  console.log("[backfill-service-sessions-note-ru] verify:")
  console.log(`  Services with sourceCatalogItemId: ${services.length}`)
  console.log(`  With sessionsNoteRu:  ${withNote}`)
  console.log(`  Without sessionsNoteRu: ${withoutNote}`)
  if (missing.length > 0) {
    console.log("  Missing (CatalogItem had data but Service not backfilled):")
    missing.forEach((m) => console.log(`    ${m}`))
  }
  console.log(ok ? "\n  ✓ VERIFY PASSED" : "\n  ✗ VERIFY FAILED")
  if (!ok) process.exitCode = 1
}

async function main() {
  const mode = (process.argv[2] || "dry-run").toLowerCase() as Mode
  if (!["dry-run", "apply", "verify"].includes(mode)) {
    console.error("Usage: npx ts-node scripts/backfill-service-sessions-note-ru.ts [dry-run|apply|verify]")
    process.exit(1)
  }
  if (mode === "dry-run") await runDryRun()
  else if (mode === "apply") await runApply()
  else await runVerify()
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error("[backfill-service-sessions-note-ru] Fatal:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
