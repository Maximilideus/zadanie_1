import { PrismaClient, CatalogCategory, CatalogItemType } from "@prisma/client"

/**
 * One-time migration: make ELECTRO zone items (face/body groups) directly
 * bookable by assigning them the default "Electro 15 min" service, price,
 * and duration. This supports the Telegram flow where users select a
 * concrete zone and proceed straight to master selection.
 */

const prisma = new PrismaClient()

const DEFAULT_ELECTRO_SERVICE_NAME = "Electro 15 min"
const DEFAULT_PRICE = 900
const DEFAULT_DURATION_MIN = 15
const BOOKABLE_GROUP_KEYS = ["face", "body"]

async function main() {
  const zoneItems = await prisma.catalogItem.findMany({
    where: {
      category: CatalogCategory.ELECTRO,
      groupKey: { in: BOOKABLE_GROUP_KEYS },
    },
    select: {
      id: true,
      locationId: true,
      titleRu: true,
      groupKey: true,
      type: true,
      serviceId: true,
      price: true,
      durationMin: true,
    },
  })

  if (zoneItems.length === 0) {
    console.log("No ELECTRO zone items found in face/body groups.")
    return
  }

  console.log(`Found ${zoneItems.length} ELECTRO zone items in face/body groups.`)

  const locationIds = [...new Set(zoneItems.map((i) => i.locationId))]
  const services = await prisma.service.findMany({
    where: {
      name: DEFAULT_ELECTRO_SERVICE_NAME,
      locationId: { in: locationIds },
    },
    select: { id: true, locationId: true, name: true },
  })

  const serviceByLocation = new Map<string, string>()
  for (const s of services) {
    serviceByLocation.set(s.locationId, s.id)
  }

  if (serviceByLocation.size === 0) {
    console.error(
      `Service "${DEFAULT_ELECTRO_SERVICE_NAME}" not found in any location. ` +
      `Run seed first to create services.`
    )
    return
  }

  let updated = 0
  let skipped = 0
  let noService = 0

  for (const item of zoneItems) {
    const targetServiceId = serviceByLocation.get(item.locationId)
    if (!targetServiceId) {
      noService++
      console.warn(`  [NO SERVICE] "${item.titleRu}" — no "${DEFAULT_ELECTRO_SERVICE_NAME}" in location ${item.locationId}`)
      continue
    }

    if (
      item.serviceId === targetServiceId &&
      item.price === DEFAULT_PRICE &&
      item.durationMin === DEFAULT_DURATION_MIN
    ) {
      skipped++
      continue
    }

    await prisma.catalogItem.update({
      where: { id: item.id },
      data: {
        serviceId: targetServiceId,
        price: DEFAULT_PRICE,
        durationMin: DEFAULT_DURATION_MIN,
      },
    })
    updated++
    console.log(`  [UPDATED] "${item.titleRu}" (${item.groupKey}) -> serviceId=${targetServiceId}`)
  }

  console.log("\n=== Make Electro Zones Bookable — summary ===")
  console.log(`Total zone items:     ${zoneItems.length}`)
  console.log(`Updated:              ${updated}`)
  console.log(`Already correct:      ${skipped}`)
  console.log(`No matching service:  ${noService}`)
}

main()
  .catch((e) => {
    console.error(e)
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
