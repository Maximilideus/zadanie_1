import { prisma } from "../../lib/prisma"
import type { CatalogCategory } from "@prisma/client"

const catalogItemPackageSelect = {
  item: {
    select: { price: true, durationMin: true },
  },
} as const

export async function findCatalogItemById(id: string) {
  return prisma.catalogItem.findUnique({
    where: { id },
    select: {
      id: true,
      category: true,
      type: true,
      gender: true,
      groupKey: true,
      titleRu: true,
      subtitleRu: true,
      descriptionRu: true,
      sessionsNoteRu: true,
      price: true,
      durationMin: true,
      serviceId: true,
      isVisible: true,
      service: {
        select: { id: true, name: true, durationMin: true, price: true },
      },
      packageItemsAsPackage: {
        select: catalogItemPackageSelect,
        orderBy: { sortOrder: "asc" },
      },
    },
  })
}

export async function getDefaultLocationId() {
  const location = await prisma.location.findFirst({
    select: { id: true },
  })

  if (!location) {
    throw new Error("NO_LOCATION_CONFIGURED")
  }

  return location.id
}

export async function findCatalogItemsByLocationAndCategory(
  locationId: string,
  category: CatalogCategory,
) {
  return prisma.catalogItem.findMany({
    where: {
      locationId,
      category,
      isVisible: true,
    },
    orderBy: [
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      type: true,
      gender: true,
      groupKey: true,
      titleRu: true,
      subtitleRu: true,
      descriptionRu: true,
      sessionsNoteRu: true,
      price: true,
      durationMin: true,
      packageItemsAsPackage: {
        select: catalogItemPackageSelect,
        orderBy: { sortOrder: "asc" },
      },
    },
  })
}

// ── New-model queries for website price list ──────────────────

export async function findServicesByLocationAndCategory(
  locationId: string,
  category: CatalogCategory,
) {
  return prisma.service.findMany({
    where: { locationId, category, isVisible: true, showOnWebsite: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      gender: true,
      groupKey: true,
      description: true,
      sessionDurationLabelRu: true,
      sessionsNoteRu: true,
      courseTermRu: true,
      price: true,
      durationMin: true,
      sortOrder: true,
      sourceCatalogItemId: true,
    },
  })
}

export async function findNormalizedPackagesByLocationAndCategory(
  locationId: string,
  category: CatalogCategory,
) {
  return prisma.package.findMany({
    where: {
      locationId,
      category,
      isVisible: true,
      showOnWebsite: true,
      packageKind: { in: ["MIGRATED", "MANUAL"] },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      gender: true,
      description: true,
      price: true,
      durationMin: true,
      sortOrder: true,
      sourceLegacyPackageId: true,
      normalizedVariantKey: true,
      services: {
        orderBy: { sortOrder: "asc" },
        select: { service: { select: { name: true } } },
      },
    },
  })
}

export async function findSubscriptionsByLocationAndCategory(
  locationId: string,
  category: CatalogCategory,
) {
  return prisma.subscription.findMany({
    where: {
      locationId,
      category,
      isVisible: true,
      showOnWebsite: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      gender: true,
      quantity: true,
      discountPercent: true,
      finalPrice: true,
      baseServiceId: true,
      basePackageId: true,
      baseService: {
        select: { id: true, name: true, durationMin: true },
      },
      basePackage: {
        select: {
          id: true,
          name: true,
          durationMin: true,
          services: {
            orderBy: { sortOrder: "asc" },
            select: { service: { select: { name: true } } },
          },
        },
      },
    },
  })
}

/**
 * All Service.sourceCatalogItemId values for a location/category,
 * regardless of visibility. Used to build the fallback exclusion list.
 */
export async function findAllServiceSourceIds(
  locationId: string,
  category: CatalogCategory,
): Promise<string[]> {
  const rows = await prisma.service.findMany({
    where: { locationId, category, sourceCatalogItemId: { not: null } },
    select: { sourceCatalogItemId: true },
  })
  return rows.map((r) => r.sourceCatalogItemId).filter((id): id is string => id !== null)
}

/**
 * All Package.sourceLegacyPackageId values for a location/category,
 * regardless of visibility. Used to build the fallback exclusion list.
 */
export async function findAllNormalizedPackageSourceIds(
  locationId: string,
  category: CatalogCategory,
): Promise<string[]> {
  const rows = await prisma.package.findMany({
    where: { locationId, category, sourceLegacyPackageId: { not: null } },
    select: { sourceLegacyPackageId: true },
  })
  return rows.map((r) => r.sourceLegacyPackageId).filter((id): id is string => id !== null)
}

export async function findCatalogItemGroupKeys(ids: string[]) {
  if (ids.length === 0) return new Map<string, string | null>()
  const rows = await prisma.catalogItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, groupKey: true },
  })
  return new Map(rows.map((r) => [r.id, r.groupKey]))
}

/**
 * Fetch CatalogItems NOT already represented by Service or normalized Package.
 * excludeIds: CatalogItem IDs already covered by Service.sourceCatalogItemId
 *             or Package.sourceLegacyPackageId.
 */
export async function findFallbackCatalogItems(
  locationId: string,
  category: CatalogCategory,
  excludeIds: string[],
) {
  return prisma.catalogItem.findMany({
    where: {
      locationId,
      category,
      isVisible: true,
      type: { notIn: ["PACKAGE"] },
      ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      type: true,
      gender: true,
      groupKey: true,
      titleRu: true,
      subtitleRu: true,
      descriptionRu: true,
      sessionsNoteRu: true,
      price: true,
      durationMin: true,
    },
  })
}

