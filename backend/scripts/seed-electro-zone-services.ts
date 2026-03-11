/**
 * Seed ELECTRO zone-like Service rows for the Electro informational table.
 * These are informational only (not bookable).
 *
 * Uniqueness: category=ELECTRO + zoneKey + gender + locationId
 * Do NOT create duplicates.
 *
 * Modes: dry-run | apply | verify
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

type Mode = "dry-run" | "apply" | "verify"

type CatalogGender = "FEMALE" | "MALE" | "UNISEX"

type ZoneSeed = {
  name: string
  zoneKey: string
  groupKey: "face" | "body" | "intimate"
  gender: CatalogGender
  sessionDurationLabelRu: string
  sessionsNoteRu: string
  courseTermRu: string
}

const ELECTRO_ZONES: ZoneSeed[] = [
  // FACE / female
  { name: "Верхняя губа", zoneKey: "upper-lip", groupKey: "face", gender: "FEMALE", sessionDurationLabelRu: "15 мин", sessionsNoteRu: "8–12 сеансов", courseTermRu: "6–9 месяцев" },
  { name: "Подбородок", zoneKey: "chin", groupKey: "face", gender: "FEMALE", sessionDurationLabelRu: "15 мин", sessionsNoteRu: "8–12 сеансов", courseTermRu: "6–9 месяцев" },
  { name: "Щёки / скулы", zoneKey: "cheeks", groupKey: "face", gender: "FEMALE", sessionDurationLabelRu: "20 мин", sessionsNoteRu: "10–14 сеансов", courseTermRu: "8–12 месяцев" },
  { name: "Брови", zoneKey: "brows", groupKey: "face", gender: "FEMALE", sessionDurationLabelRu: "15 мин", sessionsNoteRu: "8–12 сеансов", courseTermRu: "6–9 месяцев" },
  { name: "Шея", zoneKey: "neck", groupKey: "face", gender: "FEMALE", sessionDurationLabelRu: "15 мин", sessionsNoteRu: "8–12 сеансов", courseTermRu: "6–9 месяцев" },

  // BODY / female
  { name: "Ареолы", zoneKey: "areola", groupKey: "body", gender: "FEMALE", sessionDurationLabelRu: "15 мин", sessionsNoteRu: "8–12 сеансов", courseTermRu: "6–9 месяцев" },
  { name: "Белая линия живота", zoneKey: "abdomen-line", groupKey: "body", gender: "FEMALE", sessionDurationLabelRu: "15 мин", sessionsNoteRu: "8–12 сеансов", courseTermRu: "6–9 месяцев" },
  { name: "Пальцы рук / ног", zoneKey: "fingers", groupKey: "body", gender: "FEMALE", sessionDurationLabelRu: "15 мин", sessionsNoteRu: "6–10 сеансов", courseTermRu: "6–9 месяцев" },
  { name: "Единичные волосы", zoneKey: "single-hairs", groupKey: "body", gender: "FEMALE", sessionDurationLabelRu: "15 мин", sessionsNoteRu: "4–8 сеансов", courseTermRu: "3–6 месяцев" },
  { name: "Подмышки", zoneKey: "armpits", groupKey: "body", gender: "FEMALE", sessionDurationLabelRu: "20 мин", sessionsNoteRu: "10–15 сеансов", courseTermRu: "8–12 месяцев" },
  { name: "Предплечья", zoneKey: "forearms", groupKey: "body", gender: "FEMALE", sessionDurationLabelRu: "30 мин", sessionsNoteRu: "10–14 сеансов", courseTermRu: "8–12 месяцев" },
  { name: "Руки полностью", zoneKey: "full-arms", groupKey: "body", gender: "FEMALE", sessionDurationLabelRu: "60 мин", sessionsNoteRu: "12–16 сеансов", courseTermRu: "10–14 месяцев" },
  { name: "Голени", zoneKey: "lower-legs", groupKey: "body", gender: "FEMALE", sessionDurationLabelRu: "45 мин", sessionsNoteRu: "12–18 сеансов", courseTermRu: "10–14 месяцев" },
  { name: "Бёдра", zoneKey: "thighs", groupKey: "body", gender: "FEMALE", sessionDurationLabelRu: "45 мин", sessionsNoteRu: "12–18 сеансов", courseTermRu: "10–14 месяцев" },
  { name: "Ноги полностью", zoneKey: "full-legs", groupKey: "body", gender: "FEMALE", sessionDurationLabelRu: "90 мин", sessionsNoteRu: "14–20 сеансов", courseTermRu: "12–18 месяцев" },
  { name: "Живот", zoneKey: "abdomen", groupKey: "body", gender: "FEMALE", sessionDurationLabelRu: "20 мин", sessionsNoteRu: "8–12 сеансов", courseTermRu: "6–9 месяцев" },
  { name: "Живот полностью", zoneKey: "abdomen-full", groupKey: "body", gender: "FEMALE", sessionDurationLabelRu: "30 мин", sessionsNoteRu: "10–14 сеансов", courseTermRu: "8–12 месяцев" },
  { name: "Спина полностью", zoneKey: "full-back", groupKey: "body", gender: "FEMALE", sessionDurationLabelRu: "60 мин", sessionsNoteRu: "12–18 сеансов", courseTermRu: "10–14 месяцев" },
  { name: "Плечи", zoneKey: "shoulders", groupKey: "body", gender: "FEMALE", sessionDurationLabelRu: "30 мин", sessionsNoteRu: "10–14 сеансов", courseTermRu: "8–12 месяцев" },
  { name: "Грудь", zoneKey: "chest", groupKey: "body", gender: "FEMALE", sessionDurationLabelRu: "30 мин", sessionsNoteRu: "10–14 сеансов", courseTermRu: "8–12 месяцев" },
  { name: "Ягодицы", zoneKey: "buttocks", groupKey: "body", gender: "FEMALE", sessionDurationLabelRu: "30 мин", sessionsNoteRu: "10–14 сеансов", courseTermRu: "8–12 месяцев" },

  // INTIMATE / female
  { name: "Бикини классическое", zoneKey: "classic-bikini", groupKey: "intimate", gender: "FEMALE", sessionDurationLabelRu: "30 мин", sessionsNoteRu: "10–14 сеансов", courseTermRu: "8–12 месяцев" },
  { name: "Бикини глубокое", zoneKey: "deep-bikini", groupKey: "intimate", gender: "FEMALE", sessionDurationLabelRu: "45 мин", sessionsNoteRu: "12–16 сеансов", courseTermRu: "10–14 месяцев" },
  { name: "Тотальное бикини", zoneKey: "total-bikini", groupKey: "intimate", gender: "FEMALE", sessionDurationLabelRu: "60 мин", sessionsNoteRu: "14–18 сеансов", courseTermRu: "12–18 месяцев" },

  // INTIMATE / male
  { name: "Интимная зона (мужская)", zoneKey: "male-intimate", groupKey: "intimate", gender: "MALE", sessionDurationLabelRu: "45 мин", sessionsNoteRu: "12–18 сеансов", courseTermRu: "10–14 месяцев" },
]

async function getMainSalonLocationId(): Promise<string | null> {
  const byName = await prisma.location.findFirst({
    where: { name: "Main Salon" },
    select: { id: true },
  })
  if (byName) return byName.id
  const first = await prisma.location.findFirst({
    select: { id: true },
  })
  return first?.id ?? null
}

async function findExistingZoneService(
  locationId: string,
  zoneKey: string,
  gender: CatalogGender
) {
  return prisma.service.findFirst({
    where: {
      category: "ELECTRO",
      groupKey: { not: "time" },
      zoneKey,
      gender,
      locationId,
    },
    select: {
      id: true,
      name: true,
      sessionDurationLabelRu: true,
      sessionsNoteRu: true,
      courseTermRu: true,
    },
  })
}

async function runDryRun() {
  const locationId = await getMainSalonLocationId()
  if (!locationId) {
    console.log("[seed-electro-zone-services] dry-run:")
    console.log("  missingLocation:  1 (no Main Salon or any location)")
    return
  }

  let scanned = 0
  let toCreate = 0
  let toUpdateDisplayFields = 0
  let alreadyExisting = 0
  let duplicatesPrevented = 0

  for (const zone of ELECTRO_ZONES) {
    scanned++
    const existing = await findExistingZoneService(locationId, zone.zoneKey, zone.gender)
    if (existing) {
      alreadyExisting++
      const needsTime = !existing.sessionDurationLabelRu?.trim()
      const needsSessions = !existing.sessionsNoteRu?.trim()
      const needsCourse = !existing.courseTermRu?.trim()
      if (needsTime || needsSessions || needsCourse) {
        toUpdateDisplayFields++
      }
    } else {
      toCreate++
    }
  }

  console.log("[seed-electro-zone-services] dry-run:")
  console.log("  scanned:            ", scanned)
  console.log("  created:            ", toCreate)
  console.log("  updatedDisplayFields:", toUpdateDisplayFields)
  console.log("  alreadyExisting:     ", alreadyExisting)
  console.log("  missingLocation:    ", 0)
  console.log("  usedExisting:       ", alreadyExisting)
  console.log("  duplicatesPrevented:", duplicatesPrevented)
}

async function runApply() {
  const locationId = await getMainSalonLocationId()
  if (!locationId) {
    console.log("[seed-electro-zone-services] apply:")
    console.log("  missingLocation:  1 (no Main Salon or any location)")
    process.exitCode = 1
    return
  }

  let scanned = 0
  let created = 0
  let updatedDisplayFields = 0
  let alreadyExisting = 0
  let duplicatesPrevented = 0

  for (const zone of ELECTRO_ZONES) {
    scanned++
    const existing = await findExistingZoneService(locationId, zone.zoneKey, zone.gender)
    if (existing) {
      alreadyExisting++
      const needsTime = !existing.sessionDurationLabelRu?.trim()
      const needsSessions = !existing.sessionsNoteRu?.trim()
      const needsCourse = !existing.courseTermRu?.trim()
      if (needsTime || needsSessions || needsCourse) {
        await prisma.service.update({
          where: { id: existing.id },
          data: {
            ...(needsTime && { sessionDurationLabelRu: zone.sessionDurationLabelRu }),
            ...(needsSessions && { sessionsNoteRu: zone.sessionsNoteRu }),
            ...(needsCourse && { courseTermRu: zone.courseTermRu }),
          },
        })
        updatedDisplayFields++
      }
    } else {
      await prisma.service.create({
        data: {
          name: zone.name,
          category: "ELECTRO",
          gender: zone.gender,
          groupKey: zone.groupKey,
          zoneKey: zone.zoneKey,
          locationId,
          price: 0,
          durationMin: 0,
          isBookable: false,
          isVisible: true,
          showOnWebsite: true,
          showInBot: false,
          sessionDurationLabelRu: zone.sessionDurationLabelRu,
          sessionsNoteRu: zone.sessionsNoteRu,
          courseTermRu: zone.courseTermRu,
          serviceKind: "BUSINESS",
          sortOrder: 0,
        },
      })
      created++
    }
  }

  console.log("[seed-electro-zone-services] apply done:")
  console.log("  scanned:            ", scanned)
  console.log("  created:            ", created)
  console.log("  updatedDisplayFields:", updatedDisplayFields)
  console.log("  alreadyExisting:     ", alreadyExisting)
  console.log("  missingLocation:    ", 0)
  console.log("  usedExisting:       ", alreadyExisting)
  console.log("  duplicatesPrevented:", duplicatesPrevented)
}

async function runVerify() {
  const locationId = await getMainSalonLocationId()
  if (!locationId) {
    console.log("[seed-electro-zone-services] verify:")
    console.log("  missingLocation:  1")
    process.exitCode = 1
    return
  }

  const services = await prisma.service.findMany({
    where: {
      category: "ELECTRO",
      groupKey: { not: "time" },
      locationId,
    },
    select: {
      id: true,
      name: true,
      zoneKey: true,
      groupKey: true,
      gender: true,
      sessionDurationLabelRu: true,
      sessionsNoteRu: true,
      courseTermRu: true,
    },
    orderBy: [{ groupKey: "asc" }, { zoneKey: "asc" }, { name: "asc" }],
  })

  const byGroupKey = new Map<string, number>()
  const byGender = new Map<string, number>()
  let withAllThree = 0

  for (const s of services) {
    const gk = s.groupKey ?? "other"
    byGroupKey.set(gk, (byGroupKey.get(gk) ?? 0) + 1)
    const genderKey = s.gender ?? "NONE"
    byGender.set(genderKey, (byGender.get(genderKey) ?? 0) + 1)
    if (
      s.sessionDurationLabelRu?.trim() &&
      s.sessionsNoteRu?.trim() &&
      s.courseTermRu?.trim()
    ) {
      withAllThree++
    }
  }

  console.log("[seed-electro-zone-services] verify:")
  console.log("  total ELECTRO zone-like services:", services.length)
  console.log("  by groupKey:")
  for (const [gk, count] of [...byGroupKey.entries()].sort()) {
    console.log(`    ${gk}: ${count}`)
  }
  console.log("  by gender:")
  for (const [g, count] of [...byGender.entries()].sort()) {
    console.log(`    ${g}: ${count}`)
  }
  console.log("  with all 3 display-only fields set:", withAllThree)

  const ok = services.length >= ELECTRO_ZONES.length && withAllThree >= ELECTRO_ZONES.length
  console.log(ok ? "\n  ✓ VERIFY PASSED" : "\n  ✗ VERIFY FAILED")
  if (!ok) process.exitCode = 1
}

async function main() {
  const mode = (process.argv[2] || "dry-run").toLowerCase() as Mode
  if (!["dry-run", "apply", "verify"].includes(mode)) {
    console.error(
      "Usage: npx ts-node scripts/seed-electro-zone-services.ts [dry-run|apply|verify]"
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
    console.error("[seed-electro-zone-services] Fatal:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
