/**
 * Recalculate price and durationMin for normalized Package rows
 * affected by a Service change.
 *
 * Rule:
 *   Package.price      = sum(Service.price)      via PackageService
 *   Package.durationMin = sum(Service.durationMin) via PackageService
 *
 * Only normalized packages (sourceLegacyPackageId != null) are updated.
 * Legacy packages (sourceLegacyPackageId == null) are never touched.
 */
import { prisma } from "../lib/prisma"

export async function recalcAffectedPackages(serviceId: string): Promise<{
  updated: number
  skipped: number
  errors: string[]
}> {
  const links = await prisma.packageService.findMany({
    where: { serviceId },
    select: { packageId: true },
  })

  const packageIds = [...new Set(links.map((l) => l.packageId))]
  if (packageIds.length === 0) return { updated: 0, skipped: 0, errors: [] }

  const packages = await prisma.package.findMany({
    where: { id: { in: packageIds } },
    select: { id: true, sourceLegacyPackageId: true },
  })

  let updated = 0
  let skipped = 0
  const errors: string[] = []

  for (const pkg of packages) {
    if (pkg.sourceLegacyPackageId === null) {
      skipped += 1
      continue
    }

    try {
      const serviceRows = await prisma.packageService.findMany({
        where: { packageId: pkg.id },
        select: {
          service: { select: { price: true, durationMin: true } },
        },
      })

      if (serviceRows.length === 0) {
        errors.push(`Package ${pkg.id}: no PackageService links found, skipping`)
        skipped += 1
        continue
      }

      const price = serviceRows.reduce((s, r) => s + r.service.price, 0)
      const durationMin = serviceRows.reduce((s, r) => s + r.service.durationMin, 0)

      await prisma.package.update({
        where: { id: pkg.id },
        data: { price, durationMin },
      })

      updated += 1
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`Package ${pkg.id}: ${msg}`)
    }
  }

  return { updated, skipped, errors }
}
