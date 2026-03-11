/**
 * Seed Service display-only fields for ELECTRO zone-like services.
 * Only for: category = ELECTRO AND groupKey != "time"
 *
 * Updates: sessionDurationLabelRu, sessionsNoteRu, courseTermRu
 * Only updates rows where the field is currently null.
 *
 * Modes: dry-run | apply | verify
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

type Mode = "dry-run" | "apply" | "verify"

const ZONE_MAPPING: Record<
  string,
  { time: string; sessions: string; course: string }
> = {
  // FACE
  "upper-lip": { time: "15 мин", sessions: "8–12 сеансов", course: "6–9 месяцев" },
  chin: { time: "15 мин", sessions: "8–12 сеансов", course: "6–9 месяцев" },
  cheeks: { time: "20 мин", sessions: "10–14 сеансов", course: "8–12 месяцев" },
  brows: { time: "15 мин", sessions: "8–12 сеансов", course: "6–9 месяцев" },
  neck: { time: "15 мин", sessions: "8–12 сеансов", course: "6–9 месяцев" },
  "full-face": { time: "30 мин", sessions: "12–16 сеансов", course: "8–12 месяцев" },

  // BODY
  areola: { time: "15 мин", sessions: "8–12 сеансов", course: "6–9 месяцев" },
  "abdomen-line": { time: "15 мин", sessions: "8–12 сеансов", course: "6–9 месяцев" },
  fingers: { time: "15 мин", sessions: "6–10 сеансов", course: "6–9 месяцев" },
  "single-hairs": { time: "15 мин", sessions: "4–8 сеансов", course: "3–6 месяцев" },
  armpits: { time: "20 мин", sessions: "10–15 сеансов", course: "8–12 месяцев" },
  forearms: { time: "30 мин", sessions: "10–14 сеансов", course: "8–12 месяцев" },
  "full-arms": { time: "60 мин", sessions: "12–16 сеансов", course: "10–14 месяцев" },
  "lower-legs": { time: "45 мин", sessions: "12–18 сеансов", course: "10–14 месяцев" },
  thighs: { time: "45 мин", sessions: "12–18 сеансов", course: "10–14 месяцев" },
  "full-legs": { time: "90 мин", sessions: "14–20 сеансов", course: "12–18 месяцев" },
  abdomen: { time: "20 мин", sessions: "8–12 сеансов", course: "6–9 месяцев" },
  "abdomen-full": { time: "30 мин", sessions: "10–14 сеансов", course: "8–12 месяцев" },
  "full-back": { time: "60 мин", sessions: "12–18 сеансов", course: "10–14 месяцев" },
  shoulders: { time: "30 мин", sessions: "10–14 сеансов", course: "8–12 месяцев" },
  chest: { time: "30 мин", sessions: "10–14 сеансов", course: "8–12 месяцев" },
  buttocks: { time: "30 мин", sessions: "10–14 сеансов", course: "8–12 месяцев" },

  // INTIMATE
  "male-intimate": { time: "45 мин", sessions: "12–18 сеансов", course: "10–14 месяцев" },
  "classic-bikini": { time: "30 мин", sessions: "10–14 сеансов", course: "8–12 месяцев" },
  "deep-bikini": { time: "45 мин", sessions: "12–16 сеансов", course: "10–14 месяцев" },
  "total-bikini": { time: "60 мин", sessions: "14–18 сеансов", course: "12–18 месяцев" },
}

const DEFAULT_TIME = "20 мин"
const DEFAULT_SESSIONS = "10–14 сеансов"
const DEFAULT_COURSE = "8–12 месяцев"

async function runDryRun() {
  const services = await prisma.service.findMany({
    where: { category: "ELECTRO", groupKey: { not: "time" } },
    select: {
      id: true,
      name: true,
      zoneKey: true,
      sessionDurationLabelRu: true,
      sessionsNoteRu: true,
      courseTermRu: true,
    },
    orderBy: [{ zoneKey: "asc" }, { name: "asc" }],
  })

  let scanned = services.length
  let toUpdateTimeLabel = 0
  let toUpdateSessions = 0
  let toUpdateCourse = 0
  let alreadySet = 0
  let missingZoneKey = 0
  let usedFallback = 0

  for (const svc of services) {
    const needsTime = !svc.sessionDurationLabelRu?.trim()
    const needsSessions = !svc.sessionsNoteRu?.trim()
    const needsCourse = !svc.courseTermRu?.trim()
    if (!needsTime && !needsSessions && !needsCourse) {
      alreadySet++
      continue
    }
    const mapping = svc.zoneKey ? ZONE_MAPPING[svc.zoneKey] : null
    const hasMapping = !!mapping
    if (!svc.zoneKey || !hasMapping) {
      missingZoneKey++
      usedFallback++
    }
    if (needsTime) toUpdateTimeLabel++
    if (needsSessions) toUpdateSessions++
    if (needsCourse) toUpdateCourse++
  }

  console.log("[seed-electro-display-fields] dry-run:")
  console.log(`  scanned:           ${scanned}`)
  console.log(`  updatedTimeLabel:   ${toUpdateTimeLabel}`)
  console.log(`  updatedSessions:   ${toUpdateSessions}`)
  console.log(`  updatedCourse:     ${toUpdateCourse}`)
  console.log(`  alreadySet:        ${alreadySet}`)
  console.log(`  missingZoneKey:    ${missingZoneKey}`)
  console.log(`  usedFallback:      ${usedFallback}`)
  console.log("\n  Per-service preview:")
  for (const svc of services) {
    const needsTime = !svc.sessionDurationLabelRu?.trim()
    const needsSessions = !svc.sessionsNoteRu?.trim()
    const needsCourse = !svc.courseTermRu?.trim()
    if (!needsTime && !needsSessions && !needsCourse) continue
    const mapping = svc.zoneKey ? ZONE_MAPPING[svc.zoneKey] : null
    const time = mapping?.time ?? DEFAULT_TIME
    const sessions = mapping?.sessions ?? DEFAULT_SESSIONS
    const course = mapping?.course ?? DEFAULT_COURSE
    console.log(
      `    "${svc.name}" zoneKey=${svc.zoneKey ?? "null"} → time="${time}" sessions="${sessions}" course="${course}"`
    )
  }
}

async function runApply() {
  const services = await prisma.service.findMany({
    where: { category: "ELECTRO", groupKey: { not: "time" } },
    select: {
      id: true,
      name: true,
      zoneKey: true,
      sessionDurationLabelRu: true,
      sessionsNoteRu: true,
      courseTermRu: true,
    },
    orderBy: [{ zoneKey: "asc" }, { name: "asc" }],
  })

  let scanned = services.length
  let updatedTimeLabel = 0
  let updatedSessions = 0
  let updatedCourse = 0
  let alreadySet = 0
  let missingZoneKey = 0
  let usedFallback = 0

  for (const svc of services) {
    const needsTime = !svc.sessionDurationLabelRu?.trim()
    const needsSessions = !svc.sessionsNoteRu?.trim()
    const needsCourse = !svc.courseTermRu?.trim()
    if (!needsTime && !needsSessions && !needsCourse) {
      alreadySet++
      continue
    }
    const mapping = svc.zoneKey ? ZONE_MAPPING[svc.zoneKey] : null
    const hasMapping = !!mapping
    if (!svc.zoneKey || !hasMapping) {
      missingZoneKey++
      usedFallback++
    }

    const time = needsTime ? (mapping?.time ?? DEFAULT_TIME) : undefined
    const sessions = needsSessions ? (mapping?.sessions ?? DEFAULT_SESSIONS) : undefined
    const course = needsCourse ? (mapping?.course ?? DEFAULT_COURSE) : undefined

    if (time !== undefined || sessions !== undefined || course !== undefined) {
      await prisma.service.update({
        where: { id: svc.id },
        data: {
          ...(time !== undefined && { sessionDurationLabelRu: time }),
          ...(sessions !== undefined && { sessionsNoteRu: sessions }),
          ...(course !== undefined && { courseTermRu: course }),
        },
      })
      if (time !== undefined) updatedTimeLabel++
      if (sessions !== undefined) updatedSessions++
      if (course !== undefined) updatedCourse++
    }
  }

  console.log("[seed-electro-display-fields] apply done:")
  console.log(`  scanned:           ${scanned}`)
  console.log(`  updatedTimeLabel:  ${updatedTimeLabel}`)
  console.log(`  updatedSessions:  ${updatedSessions}`)
  console.log(`  updatedCourse:    ${updatedCourse}`)
  console.log(`  alreadySet:        ${alreadySet}`)
  console.log(`  missingZoneKey:    ${missingZoneKey}`)
  console.log(`  usedFallback:     ${usedFallback}`)
}

async function runVerify() {
  const services = await prisma.service.findMany({
    where: { category: "ELECTRO", groupKey: { not: "time" } },
    select: {
      id: true,
      name: true,
      zoneKey: true,
      sessionDurationLabelRu: true,
      sessionsNoteRu: true,
      courseTermRu: true,
    },
    orderBy: [{ zoneKey: "asc" }, { name: "asc" }],
  })

  const withAll = services.filter(
    (s) =>
      s.sessionDurationLabelRu?.trim() &&
      s.sessionsNoteRu?.trim() &&
      s.courseTermRu?.trim()
  )
  const missingTime = services.filter((s) => !s.sessionDurationLabelRu?.trim())
  const missingSessions = services.filter((s) => !s.sessionsNoteRu?.trim())
  const missingCourse = services.filter((s) => !s.courseTermRu?.trim())

  console.log("[seed-electro-display-fields] verify:")
  console.log(`  ELECTRO zone services total: ${services.length}`)
  console.log(`  With all 3 fields:          ${withAll.length}`)
  console.log(`  Missing sessionDurationLabelRu: ${missingTime.length}`)
  console.log(`  Missing sessionsNoteRu:     ${missingSessions.length}`)
  console.log(`  Missing courseTermRu:       ${missingCourse.length}`)
  if (withAll.length > 0) {
    console.log("\n  Sample:")
    withAll.slice(0, 8).forEach((s) =>
      console.log(
        `    "${s.name}" zoneKey=${s.zoneKey ?? "null"} → ${s.sessionDurationLabelRu} | ${s.sessionsNoteRu} | ${s.courseTermRu}`
      )
    )
  }
  const ok =
    missingTime.length === 0 &&
    missingSessions.length === 0 &&
    missingCourse.length === 0
  console.log(ok ? "\n  ✓ VERIFY PASSED" : "\n  ✗ VERIFY FAILED")
  if (!ok) process.exitCode = 1
}

async function main() {
  const mode = (process.argv[2] || "dry-run").toLowerCase() as Mode
  if (!["dry-run", "apply", "verify"].includes(mode)) {
    console.error(
      "Usage: npx ts-node scripts/seed-electro-display-fields.ts [dry-run|apply|verify]"
    )
    process.exit(1)
  }
  if (mode === "dry-run") await runDryRun()
  else if (mode === "apply") await runApply()
  else await runVerify()
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error("[seed-electro-display-fields] Fatal:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
