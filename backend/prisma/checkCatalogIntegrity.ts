/**
 * Catalog integrity check.
 * Verifies all visible bookable CatalogItem rows have valid serviceId.
 *
 * Usage:  npx ts-node prisma/checkCatalogIntegrity.ts
 *         npm run check-catalog
 *
 * Exit codes:
 *   0 = all checks passed
 *   1 = integrity violations found
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const location = await prisma.location.findFirst({ select: { id: true } })
  if (!location) {
    console.error("FAIL: No Location found")
    process.exit(1)
  }

  const allVisible = await prisma.catalogItem.findMany({
    where: { locationId: location.id, isVisible: true },
    select: {
      id: true,
      category: true,
      type: true,
      groupKey: true,
      titleRu: true,
      price: true,
      durationMin: true,
      serviceId: true,
    },
  })

  const problems: string[] = []

  for (const item of allVisible) {
    const isBookable = item.price != null && item.durationMin != null
    if (!isBookable) continue

    if (!item.serviceId) {
      problems.push(
        `MISSING serviceId: "${item.titleRu}" (${item.category}/${item.groupKey}, id=${item.id})`
      )
    }
  }

  // Verify that linked serviceIds actually exist
  const linkedItems = allVisible.filter((i) => i.serviceId != null)
  const serviceIds = [...new Set(linkedItems.map((i) => i.serviceId as string))]

  if (serviceIds.length > 0) {
    const existingServices = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true },
    })
    const existingSet = new Set(existingServices.map((s) => s.id))

    for (const item of linkedItems) {
      if (!existingSet.has(item.serviceId!)) {
        problems.push(
          `DANGLING serviceId: "${item.titleRu}" (${item.category}) -> serviceId=${item.serviceId} does not exist`
        )
      }
    }
  }

  // Summary
  const bookableCount = allVisible.filter((i) => i.price != null && i.durationMin != null).length
  const linkedCount = linkedItems.length
  const infoCount = allVisible.length - bookableCount

  console.log("=== Catalog Integrity Check ===")
  console.log(`Total visible items:  ${allVisible.length}`)
  console.log(`Bookable (price+dur): ${bookableCount}`)
  console.log(`With serviceId:       ${linkedCount}`)
  console.log(`Info-only (no price): ${infoCount}`)
  console.log()

  if (problems.length > 0) {
    console.error(`FAIL: ${problems.length} integrity violations found:\n`)
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(1)
  }

  console.log("PASS: All bookable items have valid serviceId.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
