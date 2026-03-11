import type {
  CatalogItemDto,
  CatalogCategorySlug,
  CatalogGroupedResponse,
} from "./catalog.mapper"
import {
  mapSlugToCatalogCategory,
  mapCatalogItemToDto,
  mapServiceToDto,
  mapNormalizedPackageToDto,
  buildGroupedCatalogResponse,
} from "./catalog.mapper"
import {
  getDefaultLocationId,
  findCatalogItemsByLocationAndCategory,
  findCatalogItemById,
  findServicesByLocationAndCategory,
  findNormalizedPackagesByLocationAndCategory,
  findAllServiceSourceIds,
  findAllNormalizedPackageSourceIds,
  findCatalogItemGroupKeys,
  findFallbackCatalogItems,
} from "./catalog.repository"

export type CatalogResponse = {
  category: CatalogCategorySlug
  items: CatalogItemDto[]
}

export async function getCatalogByCategory(
  categorySlug: CatalogCategorySlug,
): Promise<CatalogResponse> {
  const locationId = await getDefaultLocationId()
  const category = mapSlugToCatalogCategory(categorySlug)

  const records = await findCatalogItemsByLocationAndCategory(
    locationId,
    category,
  )

  return {
    category: categorySlug,
    items: records.map(mapCatalogItemToDto),
  }
}

export async function getCatalogItemById(id: string) {
  const raw = await findCatalogItemById(id)
  if (!raw) return null

  let price = raw.price ?? null
  let durationMin = raw.durationMin ?? null
  if (raw.type === "PACKAGE" && raw.packageItemsAsPackage?.length) {
    price = raw.packageItemsAsPackage.reduce((s, p) => s + (p.item.price ?? 0), 0)
    durationMin = raw.packageItemsAsPackage.reduce((s, p) => s + (p.item.durationMin ?? 0), 0)
  }

  const { packageItemsAsPackage: _, ...rest } = raw
  return { ...rest, price, durationMin }
}

/**
 * Build grouped catalog response from new business models:
 * - Service (atomic services, replaces CatalogItem ZONE)
 * - normalized Package (replaces CatalogItem PACKAGE, with correct gender variants)
 * - CatalogItem fallback for INFO/OFFER items not yet migrated to Service
 *
 * Each entity keeps its own gender and is placed in the correct gender bucket.
 * Package variants (female/male/unisex) are separate rows, never merged.
 * Booking links still use CatalogItem IDs via sourceCatalogItemId / sourceLegacyPackageId.
 */
export async function getCatalogByCategoryGrouped(
  categorySlug: CatalogCategorySlug,
): Promise<CatalogGroupedResponse> {
  const locationId = await getDefaultLocationId()
  const category = mapSlugToCatalogCategory(categorySlug)

  const [services, normalizedPackages, allServiceSourceIds, allPackageSourceIds] = await Promise.all([
    findServicesByLocationAndCategory(locationId, category),
    findNormalizedPackagesByLocationAndCategory(locationId, category),
    findAllServiceSourceIds(locationId, category),
    findAllNormalizedPackageSourceIds(locationId, category),
  ])

  const excludeFromFallback = [...allServiceSourceIds, ...allPackageSourceIds]

  const visiblePackageSourceIds = normalizedPackages
    .map((p) => p.sourceLegacyPackageId)
    .filter((id): id is string => id !== null)

  const [packageGroupKeyMap, fallbackItems] = await Promise.all([
    findCatalogItemGroupKeys(visiblePackageSourceIds),
    findFallbackCatalogItems(locationId, category, excludeFromFallback),
  ])

  const items: CatalogItemDto[] = [
    ...services.map(mapServiceToDto),
    ...normalizedPackages.map((p) => mapNormalizedPackageToDto(p, packageGroupKeyMap)),
    ...fallbackItems.map(mapCatalogItemToDto),
  ]

  return buildGroupedCatalogResponse(categorySlug, items)
}

