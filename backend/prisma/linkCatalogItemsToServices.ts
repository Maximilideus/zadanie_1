import { PrismaClient, CatalogCategory, CatalogItemType } from "@prisma/client"

const prisma = new PrismaClient()

type CatalogRow = {
  id: string
  locationId: string
  category: CatalogCategory
  type: CatalogItemType
  groupKey: string | null
  titleRu: string
  durationMin: number | null
  serviceId: string | null
}

// ── Service name resolution by category ──────────────────────────────

function resolveLaserServiceName(durationMin: number): string {
  if (durationMin <= 15) return "Laser 15 min"
  if (durationMin <= 30) return "Laser 30 min"
  if (durationMin <= 45) return "Laser 45 min"
  if (durationMin <= 60) return "Laser 60 min"
  if (durationMin <= 90) return "Laser 90 min"
  return "Laser 120 min"
}

function resolveWaxServiceName(durationMin: number): string {
  if (durationMin <= 15) return "Waxing 15 min"
  if (durationMin <= 25) return "Waxing 25 min"
  if (durationMin <= 35) return "Waxing 35 min"
  if (durationMin <= 50) return "Waxing 50 min"
  return "Waxing 60 min"
}

const ELECTRO_DURATION_MAP: Record<number, string> = {
  15: "Electro 15 min",
  30: "Electro 30 min",
  45: "Electro 45 min",
  60: "Electro 60 min",
  90: "Electro 90 min",
  120: "Electro 120 min",
}

const MASSAGE_TITLE_MAP: [RegExp, string][] = [
  [/Classic|Классический/i, "Massage Classic 60 min"],
  [/Relax|Расслабляющий/i, "Massage Relax 60 min"],
  [/Sport|Спортивный/i, "Massage Sport 60 min"],
  [/Lymph|Лимфодренажный/i, "Massage Lymph 60 min"],
]

function resolveTargetServiceName(item: CatalogRow): string | null {
  const { category, type, groupKey, titleRu, durationMin } = item

  switch (category) {
    case CatalogCategory.LASER:
      return durationMin != null ? resolveLaserServiceName(durationMin) : null

    case CatalogCategory.WAX:
      return durationMin != null ? resolveWaxServiceName(durationMin) : null

    case CatalogCategory.ELECTRO:
      if (type === CatalogItemType.OFFER && groupKey === "time") {
        if (durationMin == null) return null
        return ELECTRO_DURATION_MAP[durationMin] ?? null
      }
      if (groupKey === "face" || groupKey === "body") {
        return "Electro 15 min"
      }
      return null

    case CatalogCategory.MASSAGE:
      for (const [pattern, serviceName] of MASSAGE_TITLE_MAP) {
        if (pattern.test(titleRu)) return serviceName
      }
      return null

    default:
      return null
  }
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const catalogItems: CatalogRow[] = await prisma.catalogItem.findMany({
    select: {
      id: true,
      locationId: true,
      category: true,
      type: true,
      groupKey: true,
      titleRu: true,
      durationMin: true,
      serviceId: true,
    },
  })

  const services = await prisma.service.findMany({
    select: { id: true, name: true, locationId: true },
  })

  const serviceIndex = new Map<string, string>()
  for (const s of services) {
    serviceIndex.set(`${s.locationId}::${s.name}`, s.id)
  }

  let updated = 0
  let skipped = 0
  let unresolved = 0
  let alreadyCorrect = 0

  for (const item of catalogItems) {
    const targetName = resolveTargetServiceName(item)

    if (targetName == null) {
      skipped++
      continue
    }

    const key = `${item.locationId}::${targetName}`
    const targetServiceId = serviceIndex.get(key)

    if (!targetServiceId) {
      unresolved++
      console.warn(
        `[UNRESOLVED] CatalogItem "${item.titleRu}" (${item.id}) -> ` +
          `Service "${targetName}" not found in location ${item.locationId}`
      )
      continue
    }

    if (item.serviceId === targetServiceId) {
      alreadyCorrect++
      continue
    }

    await prisma.catalogItem.update({
      where: { id: item.id },
      data: { serviceId: targetServiceId },
    })
    updated++
  }

  console.log("\n=== Link CatalogItem -> Service summary ===")
  console.log(`Total catalog items:  ${catalogItems.length}`)
  console.log(`Updated serviceId:    ${updated}`)
  console.log(`Already correct:      ${alreadyCorrect}`)
  console.log(`Skipped (non-bookable / INFO): ${skipped}`)
  console.log(`Unresolved (service not found): ${unresolved}`)
}

main()
  .catch((e) => {
    console.error(e)
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })