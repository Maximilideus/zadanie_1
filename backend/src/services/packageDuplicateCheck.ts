/**
 * Duplicate protection for Package creation.
 *
 * A Package is a duplicate if all match:
 *   - category
 *   - gender
 *   - locationId
 *   - the SET of linked Service ids (order does not matter)
 *
 * Reusable by: future POST /admin/packages, package composition edit flows, validation scripts.
 */
import type { CatalogCategory, CatalogGender } from "@prisma/client"
import { prisma } from "../lib/prisma"

export interface PackageCompositionInput {
  category: CatalogCategory
  gender: CatalogGender | null
  locationId: string
  serviceIds: string[]
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Normalize service IDs for deterministic comparison.
 * - Remove duplicates
 * - Sort lexicographically
 */
export function normalizeServiceSet(serviceIds: string[]): string[] {
  return [...new Set(serviceIds)].sort()
}

/**
 * Validate candidate package composition before duplicate check or creation.
 * Returns { valid: true } or { valid: false, error: "..." }.
 */
export async function validatePackageComposition(
  input: PackageCompositionInput,
): Promise<ValidationResult> {
  const { category, gender, locationId, serviceIds } = input

  if (!serviceIds || serviceIds.length === 0) {
    return { valid: false, error: "serviceIds must not be empty" }
  }

  const uniqueIds = [...new Set(serviceIds)]
  if (uniqueIds.length !== serviceIds.length) {
    return { valid: false, error: "serviceIds must be unique" }
  }

  const services = await prisma.service.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, category: true, gender: true, locationId: true },
  })

  if (services.length !== uniqueIds.length) {
    const foundIds = new Set(services.map((s) => s.id))
    const missing = uniqueIds.filter((id) => !foundIds.has(id))
    return { valid: false, error: `Services not found: ${missing.join(", ")}` }
  }

  const first = services[0]
  for (const s of services) {
    if (s.category !== first.category || s.gender !== first.gender || s.locationId !== first.locationId) {
      return {
        valid: false,
        error: "All services must have the same category, gender, and locationId",
      }
    }
  }

  if (first.category !== category || first.gender !== gender || first.locationId !== locationId) {
    return {
      valid: false,
      error: "Package category/gender/locationId must match the selected services",
    }
  }

  return { valid: true }
}

/**
 * Find an existing Package with the same business composition.
 * Returns the first duplicate found, or null if none.
 */
export async function findDuplicatePackageByComposition(
  input: PackageCompositionInput,
): Promise<{ id: string; name: string; compositionLabel: string } | null> {
  const validation = await validatePackageComposition(input)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  const targetSet = normalizeServiceSet(input.serviceIds)

  const candidates = await prisma.package.findMany({
    where: {
      category: input.category,
      gender: input.gender,
      locationId: input.locationId,
    },
    select: {
      id: true,
      name: true,
      services: {
        orderBy: { sortOrder: "asc" },
        select: { serviceId: true, service: { select: { name: true } } },
      },
    },
  })

  for (const pkg of candidates) {
    const existingSet = normalizeServiceSet(pkg.services.map((ps) => ps.serviceId))
    if (
      existingSet.length === targetSet.length &&
      existingSet.every((id, i) => id === targetSet[i])
    ) {
      const compositionLabel = pkg.services.map((ps) => ps.service.name).join(" + ")
      return { id: pkg.id, name: pkg.name, compositionLabel }
    }
  }

  return null
}

/**
 * Assert no duplicate package exists. Throws if duplicate found.
 */
export async function assertNoDuplicatePackageComposition(
  input: PackageCompositionInput,
): Promise<void> {
  const dup = await findDuplicatePackageByComposition(input)
  if (dup) {
    const compositionText = dup.compositionLabel
      ? `\nСостав: ${dup.compositionLabel}.`
      : ""
    throw new Error(
      `DUPLICATE_PACKAGE: Комплекс с таким составом уже существует.${compositionText}\nОткройте существующий комплекс и измените его, если нужно.`,
    )
  }
}
