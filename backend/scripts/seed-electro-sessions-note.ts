/**
 * Seed Service.sessionsNoteRu for ELECTRO services based on zoneKey.
 *
 * Only updates services where sessionsNoteRu IS NULL.
 * Does NOT overwrite existing sessionsNoteRu.
 *
 * Modes: dry-run | apply | verify
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

type Mode = "dry-run" | "apply" | "verify"

const ZONE_KEY_TO_SESSIONS: Record<string, string> = {
  // Face
  "upper-lip": "8–12 сеансов",
  chin: "8–12 сеансов",
  cheeks: "10–14 сеансов",
  "full-face": "12–16 сеансов",

  // Arms
  armpits: "10–15 сеансов",
  forearms: "10–14 сеансов",
  "full-arms": "12–16 сеансов",

  // Legs
  "lower-legs": "12–18 сеансов",
  thighs: "12–18 сеансов",
  "full-legs": "14–20 сеансов",

  // Abdomen
  abdomen: "8–12 сеансов",
  "abdomen-line": "8–12 сеансов",
  "abdomen-full": "10–14 сеансов",

  // Back / shoulders / chest
  "full-back": "12–18 сеансов",
  shoulders: "10–14 сеансов",
  chest: "10–14 сеансов",

  // Buttocks
  buttocks: "10–14 сеансов",

  // Intimate
  "male-intimate": "12–18 сеансов",
  "classic-bikini": "10–14 сеансов",
  "deep-bikini": "12–16 сеансов",
  "total-bikini": "14–18 сеансов",
}

const DEFAULT_SESSIONS = "10–14 сеансов"

async function runDryRun() {
  const services = await prisma.service.findMany({
    where: { category: "ELECTRO" },
    select: { id: true, name: true, zoneKey: true, sessionsNoteRu: true },
    orderBy: [{ zoneKey: "asc" }, { name: "asc" }],
  })

  let scanned = services.length
  let toUpdate = 0
  let alreadySet = 0
  let missingZoneKey = 0
  let usedFallback = 0

  for (const svc of services) {
    if (svc.sessionsNoteRu && svc.sessionsNoteRu.trim()) {
      alreadySet++
      continue
    }
    toUpdate++
    const hasMapping = svc.zoneKey && ZONE_KEY_TO_SESSIONS[svc.zoneKey]
    if (!svc.zoneKey || !hasMapping) {
      missingZoneKey++
      usedFallback++
    }
  }

  console.log("[seed-electro-sessions-note] dry-run:")
  console.log(`  Scanned:        ${scanned}`)
  console.log(`  To update:      ${toUpdate}`)
  console.log(`  Already set:    ${alreadySet}`)
  console.log(`  Missing zoneKey: ${missingZoneKey}`)
  console.log(`  Used fallback:  ${usedFallback}`)
  console.log("\n  Per-service preview:")
  for (const svc of services) {
    if (svc.sessionsNoteRu?.trim()) continue
    const note = svc.zoneKey && ZONE_KEY_TO_SESSIONS[svc.zoneKey]
      ? ZONE_KEY_TO_SESSIONS[svc.zoneKey]
      : DEFAULT_SESSIONS
    console.log(`    "${svc.name}" zoneKey=${svc.zoneKey ?? "null"} → "${note}"`)
  }
}

async function runApply() {
  const services = await prisma.service.findMany({
    where: { category: "ELECTRO" },
    select: { id: true, name: true, zoneKey: true, sessionsNoteRu: true },
    orderBy: [{ zoneKey: "asc" }, { name: "asc" }],
  })

  let scanned = services.length
  let updated = 0
  let alreadySet = 0
  let missingZoneKey = 0
  let usedFallback = 0

  for (const svc of services) {
    if (svc.sessionsNoteRu && svc.sessionsNoteRu.trim()) {
      alreadySet++
      continue
    }
    const hasMapping = svc.zoneKey && ZONE_KEY_TO_SESSIONS[svc.zoneKey]
    const note = hasMapping ? ZONE_KEY_TO_SESSIONS[svc.zoneKey!] : DEFAULT_SESSIONS

    if (!svc.zoneKey || !hasMapping) {
      missingZoneKey++
      usedFallback++
    }

    await prisma.service.update({
      where: { id: svc.id },
      data: { sessionsNoteRu: note },
    })
    updated++
  }

  console.log("[seed-electro-sessions-note] apply done:")
  console.log(`  Scanned:        ${scanned}`)
  console.log(`  Updated:       ${updated}`)
  console.log(`  Already set:   ${alreadySet}`)
  console.log(`  Missing zoneKey: ${missingZoneKey}`)
  console.log(`  Used fallback: ${usedFallback}`)
}

async function runVerify() {
  const services = await prisma.service.findMany({
    where: { category: "ELECTRO" },
    select: { id: true, name: true, zoneKey: true, sessionsNoteRu: true },
    orderBy: [{ zoneKey: "asc" }, { name: "asc" }],
  })

  const withNote = services.filter((s) => s.sessionsNoteRu && s.sessionsNoteRu.trim())
  const withoutNote = services.filter((s) => !s.sessionsNoteRu?.trim())

  console.log("[seed-electro-sessions-note] verify:")
  console.log(`  ELECTRO services total: ${services.length}`)
  console.log(`  With sessionsNoteRu:    ${withNote.length}`)
  console.log(`  Without sessionsNoteRu: ${withoutNote.length}`)
  if (withNote.length > 0) {
    console.log("\n  Sample with sessionsNoteRu:")
    withNote.slice(0, 10).forEach((s) =>
      console.log(`    "${s.name}" zoneKey=${s.zoneKey ?? "null"} → "${s.sessionsNoteRu}"`)
    )
  }
  if (withoutNote.length > 0) {
    console.log("\n  Still without sessionsNoteRu:")
    withoutNote.forEach((s) => console.log(`    "${s.name}" zoneKey=${s.zoneKey ?? "null"}`))
  }
  console.log(withoutNote.length === 0 ? "\n  ✓ VERIFY PASSED" : "\n  ✗ VERIFY FAILED (some services still empty)")
  if (withoutNote.length > 0) process.exitCode = 1
}

async function main() {
  const mode = (process.argv[2] || "dry-run").toLowerCase() as Mode
  if (!["dry-run", "apply", "verify"].includes(mode)) {
    console.error("Usage: npx ts-node scripts/seed-electro-sessions-note.ts [dry-run|apply|verify]")
    process.exit(1)
  }
  if (mode === "dry-run") await runDryRun()
  else if (mode === "apply") await runApply()
  else await runVerify()
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error("[seed-electro-sessions-note] Fatal:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
