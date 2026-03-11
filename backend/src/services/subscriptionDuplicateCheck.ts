/**
 * Duplicate protection for Subscription creation.
 *
 * A Subscription is a duplicate if all match:
 *   - same base type (SERVICE or PACKAGE)
 *   - same base entity (baseServiceId or basePackageId)
 *   - same quantity
 *   - same discountPercent
 *   - same locationId
 *
 * Reusable by: future POST /admin/subscriptions, subscription edit flows, validation scripts.
 */
import type { CatalogCategory, CatalogGender } from "@prisma/client"
import { prisma } from "../lib/prisma"

export type SubscriptionBaseType = "SERVICE" | "PACKAGE"

export interface SubscriptionDuplicateInput {
  category: CatalogCategory
  gender: CatalogGender | null
  locationId: string
  baseServiceId: string | null
  basePackageId: string | null
  quantity: number
  discountPercent: number
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate candidate subscription input before duplicate check or creation.
 * Returns { valid: true } or { valid: false, error: "..." }.
 *
 * Rules:
 * 1. Exactly one base: baseServiceId XOR basePackageId
 * 2. quantity >= 1
 * 3. discountPercent in [0, 100]
 * 4. If baseServiceId: Service must exist
 * 5. If basePackageId: Package must exist
 * 6. category, gender, locationId must match the base entity
 */
export async function validateSubscriptionInput(
  input: SubscriptionDuplicateInput,
): Promise<ValidationResult> {
  const { category, gender, locationId, baseServiceId, basePackageId, quantity, discountPercent } =
    input

  // 1. XOR: exactly one base
  const hasService = baseServiceId != null && baseServiceId !== ""
  const hasPackage = basePackageId != null && basePackageId !== ""
  if (hasService === hasPackage) {
    return {
      valid: false,
      error: "Exactly one of baseServiceId or basePackageId must be provided",
    }
  }

  // 2. quantity >= 1
  if (quantity < 1 || !Number.isInteger(quantity)) {
    return { valid: false, error: "quantity must be an integer >= 1" }
  }

  // 3. discountPercent in [0, 100]
  if (
    discountPercent < 0 ||
    discountPercent > 100 ||
    !Number.isInteger(discountPercent)
  ) {
    return { valid: false, error: "discountPercent must be an integer between 0 and 100" }
  }

  if (hasService) {
    const service = await prisma.service.findUnique({
      where: { id: baseServiceId! },
      select: { id: true, category: true, gender: true, locationId: true },
    })
    if (!service) {
      return { valid: false, error: `Service not found: ${baseServiceId}` }
    }
    if (
      service.category !== category ||
      service.gender !== gender ||
      service.locationId !== locationId
    ) {
      return {
        valid: false,
        error: "Subscription category, gender, and locationId must match the base Service",
      }
    }
  } else {
    const pkg = await prisma.package.findUnique({
      where: { id: basePackageId! },
      select: { id: true, category: true, gender: true, locationId: true },
    })
    if (!pkg) {
      return { valid: false, error: `Package not found: ${basePackageId}` }
    }
    if (
      pkg.category !== category ||
      pkg.gender !== gender ||
      pkg.locationId !== locationId
    ) {
      return {
        valid: false,
        error: "Subscription category, gender, and locationId must match the base Package",
      }
    }
  }

  return { valid: true }
}

/**
 * Find an existing Subscription with the same business meaning.
 * Returns the first duplicate found, or null if none.
 * @param excludeSubscriptionId - When editing, exclude this subscription from the check.
 */
export async function findDuplicateSubscription(
  input: SubscriptionDuplicateInput,
  excludeSubscriptionId?: string,
): Promise<{ id: string; name: string } | null> {
  const validation = await validateSubscriptionInput(input)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  const hasService = input.baseServiceId != null && input.baseServiceId !== ""

  const baseWhere = hasService
    ? {
        baseServiceId: input.baseServiceId,
        basePackageId: null,
        quantity: input.quantity,
        discountPercent: input.discountPercent,
        locationId: input.locationId,
      }
    : {
        baseServiceId: null,
        basePackageId: input.basePackageId,
        quantity: input.quantity,
        discountPercent: input.discountPercent,
        locationId: input.locationId,
      }

  const where =
    excludeSubscriptionId != null
      ? { ...baseWhere, id: { not: excludeSubscriptionId } }
      : baseWhere

  const existing = await prisma.subscription.findFirst({
    where,
    select: { id: true, name: true },
  })

  return existing
}

/**
 * Assert no duplicate subscription exists. Throws if duplicate found.
 * @param excludeSubscriptionId - When editing, exclude this subscription from the check.
 */
export async function assertNoDuplicateSubscription(
  input: SubscriptionDuplicateInput,
  excludeSubscriptionId?: string,
): Promise<void> {
  const dup = await findDuplicateSubscription(input, excludeSubscriptionId)
  if (dup) {
    throw new Error(
      `DUPLICATE_SUBSCRIPTION: Subscription "${dup.name}" (${dup.id}) already exists with the same base, quantity, and discount`,
    )
  }
}
