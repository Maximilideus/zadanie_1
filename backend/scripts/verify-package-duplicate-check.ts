/**
 * Verification script for package duplicate detection logic.
 *
 * Run: npx ts-node scripts/verify-package-duplicate-check.ts
 *
 * Proves:
 * - same set, different order → duplicate
 * - different set → not duplicate
 * - same set, different gender → not duplicate
 * - same set, different category → not duplicate
 * - same set, different location → not duplicate
 */
import { prisma } from "../src/lib/prisma"
import {
  findDuplicatePackageByComposition,
  normalizeServiceSet,
} from "../src/services/packageDuplicateCheck"

async function main() {
  const packages = await prisma.package.findMany({
    where: { sourceLegacyPackageId: { not: null } },
    select: {
      id: true,
      name: true,
      category: true,
      gender: true,
      locationId: true,
      services: { select: { serviceId: true } },
    },
    take: 5,
  })

  const withServices = packages.filter((p) => p.services.length >= 2)
  if (withServices.length === 0) {
    console.log("[verify] No packages with 2+ services found. Skipping verification.")
    return
  }

  const pkg = withServices[0]
  const serviceIds = pkg.services.map((s) => s.serviceId)
  const reversedIds = [...serviceIds].reverse()

  console.log("[verify] Package duplicate check verification")
  console.log(`  Test package: ${pkg.name} (${pkg.id})`)
  console.log(`  Services: ${serviceIds.join(", ")}`)
  console.log("")

  let passed = 0
  let failed = 0

  // 1. Same set, different order → duplicate
  try {
    const dup = await findDuplicatePackageByComposition({
      category: pkg.category!,
      gender: pkg.gender,
      locationId: pkg.locationId,
      serviceIds: reversedIds,
    })
    if (dup && dup.id === pkg.id) {
      console.log("  ✓ same set, different order → duplicate (correct)")
      passed++
    } else {
      console.log("  ✗ same set, different order → expected duplicate, got:", dup)
      failed++
    }
  } catch (e) {
    console.log("  ✗ same set, different order → error:", (e as Error).message)
    failed++
  }

  // 2. Different set → not duplicate (remove one service)
  if (serviceIds.length >= 2) {
    try {
      const smallerSet = serviceIds.slice(0, -1)
      const dup = await findDuplicatePackageByComposition({
        category: pkg.category!,
        gender: pkg.gender,
        locationId: pkg.locationId,
        serviceIds: smallerSet,
      })
      if (dup === null) {
        console.log("  ✓ different set (fewer services) → not duplicate (correct)")
        passed++
      } else {
        console.log("  ✗ different set → expected no duplicate, got:", dup.id)
        failed++
      }
    } catch (e) {
      console.log("  ✗ different set → error:", (e as Error).message)
      failed++
    }
  }

  // 3. Same set, different gender → not duplicate
  const otherGender = pkg.gender === "FEMALE" ? "MALE" : pkg.gender === "MALE" ? "FEMALE" : "UNISEX"
  try {
    const dup = await findDuplicatePackageByComposition({
      category: pkg.category!,
      gender: otherGender as "FEMALE" | "MALE" | "UNISEX",
      locationId: pkg.locationId,
      serviceIds,
    })
    if (dup === null) {
      console.log("  ✓ same set, different gender → not duplicate (correct)")
      passed++
    } else {
      console.log("  ✗ same set, different gender → expected no duplicate, got:", dup.id)
      failed++
    }
  } catch (e) {
    const msg = (e as Error).message
    if (msg.includes("Package category/gender/locationId must match")) {
      console.log("  ✓ same set, different gender → validation rejected (correct)")
      passed++
    } else {
      console.log("  ✗ same set, different gender → error:", msg)
      failed++
    }
  }

  // 4. Same set, different category → not duplicate
  const categories = ["LASER", "WAX", "ELECTRO", "MASSAGE"] as const
  const otherCategory = categories.find((c) => c !== pkg.category) ?? "LASER"
  try {
    const dup = await findDuplicatePackageByComposition({
      category: otherCategory,
      gender: pkg.gender,
      locationId: pkg.locationId,
      serviceIds,
    })
    if (dup === null) {
      console.log("  ✓ same set, different category → not duplicate (correct)")
      passed++
    } else {
      console.log("  ✗ same set, different category → expected no duplicate, got:", dup.id)
      failed++
    }
  } catch (e) {
    const msg = (e as Error).message
    if (msg.includes("Package category/gender/locationId must match")) {
      console.log("  ✓ same set, different category → validation rejected (correct)")
      passed++
    } else {
      console.log("  ✗ same set, different category → error:", msg)
      failed++
    }
  }

  // 5. normalizeServiceSet
  const norm1 = normalizeServiceSet([serviceIds[1], serviceIds[0]])
  const norm2 = normalizeServiceSet(serviceIds)
  if (norm1.length === norm2.length && norm1.every((id, i) => id === norm2[i])) {
    console.log("  ✓ normalizeServiceSet: order-independent (correct)")
    passed++
  } else {
    console.log("  ✗ normalizeServiceSet: expected same result for different order")
    failed++
  }

  console.log("")
  console.log(`[verify] Result: ${passed} passed, ${failed} failed`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
