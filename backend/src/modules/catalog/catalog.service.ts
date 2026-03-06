import type {
  CatalogItemDto,
  CatalogCategorySlug,
  CatalogGroupedResponse,
} from "./catalog.mapper"
import {
  mapSlugToCatalogCategory,
  mapCatalogItemToDto,
  buildGroupedCatalogResponse,
} from "./catalog.mapper"
import {
  getDefaultLocationId,
  findCatalogItemsByLocationAndCategory,
  findCatalogItemById,
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
  return findCatalogItemById(id)
}

export async function getCatalogByCategoryGrouped(
  categorySlug: CatalogCategorySlug,
): Promise<CatalogGroupedResponse> {
  const flat = await getCatalogByCategory(categorySlug)
  return buildGroupedCatalogResponse(categorySlug, flat.items)
}

