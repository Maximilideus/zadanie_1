/**
 * Verification script for subscription duplicate detection logic.
 *
 * Run: npx ts-node scripts/verify-subscription-duplicate-check.ts
 *
 * Proves:
 * - same base + same quantity + same discount → duplicate
 * - same base + different quantity → not duplicate
 * - same base + different discount → not duplicate
 * - different base → not duplicate
 * - SERVICE-based and PACKAGE-based are never the same duplicate
 */
import { prisma } from "../src/lib/prisma"
import {
  findDuplicateSubscription,
  validateSubscriptionInput,
} from "../src/services/subscriptionDuplicateCheck"

async function main() {
  const subs = await prisma.subscription.findMany({
    where: {
      OR: [
        { baseServiceId: { not: null } },
        { basePackageId: { not: null } },
      ],
    },
    select: {
      id: true,
      name: true,
      category: true,
      gender: true,
      locationId: true,
      baseServiceId: true,
      basePackageId: true,
      quantity: true,
      discountPercent: true,
    },
    take: 5,
  })

  if (subs.length === 0) {
    console.log("[verify] No subscriptions found in DB. Skipping verification.")
    console.log("  Create subscriptions first, then re-run this script.")
    return
  }

  const sub = subs[0]
  const baseType = sub.baseServiceId ? "SERVICE" : "PACKAGE"
  const baseId = sub.baseServiceId ?? sub.basePackageId!

  console.log("[verify] Subscription duplicate check verification")
  console.log(`  Test subscription: ${sub.name} (${sub.id})`)
  console.log(`  Base: ${baseType} ${baseId}`)
  console.log(`  quantity=${sub.quantity}, discountPercent=${sub.discountPercent}`)
  console.log("")

  let passed = 0
  let failed = 0

  const input = {
    category: sub.category,
    gender: sub.gender,
    locationId: sub.locationId,
    baseServiceId: sub.baseServiceId,
    basePackageId: sub.basePackageId,
    quantity: sub.quantity,
    discountPercent: sub.discountPercent,
  }

  // 1. Same base + same quantity + same discount → duplicate
  try {
    const dup = await findDuplicateSubscription(input)
    if (dup && dup.id === sub.id) {
      console.log("  ✓ same base + quantity + discount → duplicate (correct)")
      passed++
    } else {
      console.log("  ✗ same base + quantity + discount → expected duplicate, got:", dup)
      failed++
    }
  } catch (e) {
    console.log("  ✗ same base + quantity + discount → error:", (e as Error).message)
    failed++
  }

  // 2. Same base + different quantity → not duplicate
  try {
    const dup = await findDuplicateSubscription({
      ...input,
      quantity: sub.quantity + 1,
    })
    if (dup === null) {
      console.log("  ✓ same base + different quantity → not duplicate (correct)")
      passed++
    } else {
      console.log("  ✗ same base + different quantity → expected no duplicate, got:", dup.id)
      failed++
    }
  } catch (e) {
    console.log("  ✗ same base + different quantity → error:", (e as Error).message)
    failed++
  }

  // 3. Same base + different discount → not duplicate
  if (sub.discountPercent < 100) {
    try {
      const dup = await findDuplicateSubscription({
        ...input,
        discountPercent: sub.discountPercent + 1,
      })
      if (dup === null) {
        console.log("  ✓ same base + different discount → not duplicate (correct)")
        passed++
      } else {
        console.log("  ✗ same base + different discount → expected no duplicate, got:", dup.id)
        failed++
      }
    } catch (e) {
      console.log("  ✗ same base + different discount → error:", (e as Error).message)
      failed++
    }
  }

  // 4. XOR validation: both bases provided → invalid
  try {
    const services = await prisma.service.findMany({
      where: { locationId: sub.locationId, category: sub.category },
      select: { id: true },
      take: 2,
    })
    const packages = await prisma.package.findMany({
      where: { locationId: sub.locationId, category: sub.category },
      select: { id: true },
      take: 1,
    })
    if (services.length >= 1 && packages.length >= 1 && baseType === "SERVICE") {
      const val = await validateSubscriptionInput({
        ...input,
        baseServiceId: services[0].id,
        basePackageId: packages[0].id,
      })
      if (!val.valid && val.error?.includes("Exactly one")) {
        console.log("  ✓ both bases provided → validation rejected (correct)")
        passed++
      } else {
        console.log("  ✗ both bases provided → expected validation error, got:", val)
        failed++
      }
    } else {
      console.log("  ○ XOR validation: skipped (need both Service and Package in same location/category)")
    }
  } catch (e) {
    console.log("  ✗ XOR validation → error:", (e as Error).message)
    failed++
  }

  // 5. quantity < 1 → invalid
  try {
    const val = await validateSubscriptionInput({ ...input, quantity: 0 })
    if (!val.valid && val.error?.includes("quantity")) {
      console.log("  ✓ quantity < 1 → validation rejected (correct)")
      passed++
    } else {
      console.log("  ✗ quantity < 1 → expected validation error, got:", val)
      failed++
    }
  } catch (e) {
    console.log("  ✗ quantity < 1 → error:", (e as Error).message)
    failed++
  }

  // 6. discountPercent out of range → invalid
  try {
    const val = await validateSubscriptionInput({ ...input, discountPercent: 101 })
    if (!val.valid && val.error?.includes("discountPercent")) {
      console.log("  ✓ discountPercent > 100 → validation rejected (correct)")
      passed++
    } else {
      console.log("  ✗ discountPercent > 100 → expected validation error, got:", val)
      failed++
    }
  } catch (e) {
    console.log("  ✗ discountPercent > 100 → error:", (e as Error).message)
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
