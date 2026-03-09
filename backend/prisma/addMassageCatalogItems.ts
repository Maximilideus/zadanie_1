/**
 * One-time script: insert MASSAGE CatalogItem records linked to existing Service records.
 *
 * Usage:  npx tsx prisma/addMassageCatalogItems.ts
 */
/// <reference types="node" />
import { PrismaClient, CatalogCategory, CatalogItemType, CatalogGender } from "@prisma/client"

const prisma = new PrismaClient()

const MASSAGE_ITEMS: {
  titleRu: string
  serviceName: string
  price: number
  durationMin: number
}[] = [
  { titleRu: "Классический массаж", serviceName: "Massage Classic 60 min", price: 2000, durationMin: 60 },
  { titleRu: "Расслабляющий массаж", serviceName: "Massage Relax 60 min", price: 2000, durationMin: 60 },
  { titleRu: "Спортивный массаж", serviceName: "Massage Sport 60 min", price: 2200, durationMin: 60 },
  { titleRu: "Лимфодренажный массаж", serviceName: "Massage Lymph 60 min", price: 2200, durationMin: 60 },
]

async function main() {
  const location = await prisma.location.findFirst({ select: { id: true } })
  if (!location) {
    console.error("No Location found.")
    process.exit(1)
  }

  const existingServices = await prisma.service.findMany({
    where: { locationId: location.id },
    select: { id: true, name: true },
  })
  const serviceByName = Object.fromEntries(existingServices.map((s) => [s.name, s.id]))

  const existing = await prisma.catalogItem.findMany({
    where: { category: CatalogCategory.MASSAGE, locationId: location.id },
    select: { titleRu: true },
  })
  const existingTitles = new Set(existing.map((e) => e.titleRu))

  let created = 0
  let skipped = 0
  let sortOrder = await prisma.catalogItem.count({ where: { locationId: location.id } })

  for (const item of MASSAGE_ITEMS) {
    if (existingTitles.has(item.titleRu)) {
      console.log(`[SKIP] "${item.titleRu}" already exists`)
      skipped++
      continue
    }

    const serviceId = serviceByName[item.serviceName] ?? null
    if (!serviceId) {
      console.warn(`[WARN] Service "${item.serviceName}" not found — creating without serviceId`)
    }

    await prisma.catalogItem.create({
      data: {
        locationId: location.id,
        category: CatalogCategory.MASSAGE,
        type: CatalogItemType.OFFER,
        gender: CatalogGender.UNISEX,
        groupKey: "massage",
        titleRu: item.titleRu,
        subtitleRu: `${item.durationMin} мин`,
        price: item.price,
        durationMin: item.durationMin,
        serviceId,
        isVisible: true,
        sortOrder: ++sortOrder,
      },
    })

    console.log(`[CREATED] "${item.titleRu}" -> serviceId=${serviceId ?? "null"}`)
    created++
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

