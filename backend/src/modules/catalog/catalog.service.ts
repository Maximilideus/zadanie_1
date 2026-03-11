import type {
  CatalogItemDto,
  CatalogCategorySlug,
  CatalogGroupedResponseV2,
} from "./catalog.mapper"
import {
  mapSlugToCatalogCategory,
  mapCatalogItemToDto,
  mapServiceToDto,
  mapPackageToWebsiteDto,
  mapSubscriptionToWebsiteDto,
  buildCatalogGroupedResponseV2,
} from "./catalog.mapper"
import {
  getDefaultLocationId,
  findCatalogItemsByLocationAndCategory,
  findCatalogItemById,
  findServicesByLocationAndCategory,
  findNormalizedPackagesByLocationAndCategory,
  findSubscriptionsByLocationAndCategory,
  findAllServiceSourceIds,
  findAllNormalizedPackageSourceIds,
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
 * - Services (grouped by gender + groupKey: face/body/intimate/other)
 * - Packages (separate block, grouped by gender)
 * - Subscriptions (separate block, grouped by gender)
 * - CatalogItem fallback for INFO/OFFER items not yet migrated to Service
 */
export async function getCatalogByCategoryGrouped(
  categorySlug: CatalogCategorySlug,
): Promise<CatalogGroupedResponseV2> {
  const locationId = await getDefaultLocationId()
  const category = mapSlugToCatalogCategory(categorySlug)

  const [
    services,
    packages,
    subscriptions,
    allServiceSourceIds,
    allPackageSourceIds,
  ] = await Promise.all([
    findServicesByLocationAndCategory(locationId, category),
    findNormalizedPackagesByLocationAndCategory(locationId, category),
    findSubscriptionsByLocationAndCategory(locationId, category),
    findAllServiceSourceIds(locationId, category),
    findAllNormalizedPackageSourceIds(locationId, category),
  ])

  const excludeFromFallback = [...allServiceSourceIds, ...allPackageSourceIds]
  const fallback = await findFallbackCatalogItems(locationId, category, excludeFromFallback)

  const serviceItems: CatalogItemDto[] = [
    ...services.map(mapServiceToDto),
    ...fallback.map(mapCatalogItemToDto),
  ]

  const packageDtos = packages.map(mapPackageToWebsiteDto)
  const subscriptionDtos = subscriptions.map(mapSubscriptionToWebsiteDto)

  return buildCatalogGroupedResponseV2(
    categorySlug,
    serviceItems,
    packageDtos,
    subscriptionDtos,
  )
}

