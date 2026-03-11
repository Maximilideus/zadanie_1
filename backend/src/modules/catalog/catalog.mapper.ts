import type {
  CatalogCategory,
  CatalogGender,
  CatalogItemType,
} from "@prisma/client"

export type CatalogCategorySlug = "laser" | "wax" | "electro" | "massage"

export type GenderBucketKey = "female" | "male" | "unisex"

const GROUP_KEY_TITLES: Record<string, string> = {
  face: "Лицо",
  body: "Тело",
  intimate: "Интимная зона",
  time: "Пакеты времени",
  info: "Информация",
  other: "Другое",
}

export function genderToBucketKey(gender: CatalogGender | null): GenderBucketKey {
  if (gender === "FEMALE") return "female"
  if (gender === "MALE") return "male"
  return "unisex"
}

export function groupKeyToTitleRu(groupKey: string): string {
  return GROUP_KEY_TITLES[groupKey] ?? groupKey
}

export function mapSlugToCatalogCategory(
  slug: CatalogCategorySlug,
): CatalogCategory {
  switch (slug) {
    case "laser":
      return "LASER"
    case "wax":
      return "WAX"
    case "electro":
      return "ELECTRO"
    case "massage":
      return "MASSAGE"
  }
}

type CatalogItemRecord = {
  id: string
  type: CatalogItemType
  gender: CatalogGender | null
  groupKey: string | null
  titleRu: string
  subtitleRu: string | null
  descriptionRu: string | null
  sessionsNoteRu: string | null
  price: number | null
  durationMin: number | null
  packageItemsAsPackage?: { item: { price: number | null; durationMin: number | null } }[]
}

export type CatalogItemDto = {
  id: string
  type: CatalogItemType
  gender: CatalogGender | null
  groupKey: string | null
  title: string
  subtitle: string | null
  description: string | null
  sessionsNoteRu: string | null
  price: number | null
  durationMin: number | null
}

/** For PACKAGE type: price and duration are derived from child items (not stored). */
export function mapCatalogItemToDto(item: CatalogItemRecord): CatalogItemDto {
  let price: number | null = item.price ?? null
  let durationMin: number | null = item.durationMin ?? null

  if (item.type === "PACKAGE" && item.packageItemsAsPackage?.length) {
    price = item.packageItemsAsPackage.reduce(
      (sum, p) => sum + (p.item.price ?? 0),
      0,
    )
    durationMin = item.packageItemsAsPackage.reduce(
      (sum, p) => sum + (p.item.durationMin ?? 0),
      0,
    )
  }

  return {
    id: item.id,
    type: item.type,
    gender: item.gender,
    groupKey: item.groupKey,
    title: item.titleRu,
    subtitle: item.subtitleRu,
    description: item.descriptionRu,
    sessionsNoteRu: item.sessionsNoteRu ?? null,
    price,
    durationMin,
  }
}

export type GroupSection = { title: string; items: CatalogItemDto[] }
export type GroupedSections = Partial<
  Record<GenderBucketKey, Record<string, GroupSection>>
>

export type CatalogGroupedResponse = {
  category: CatalogCategorySlug
  sections: GroupedSections
}

// ── New-model → DTO mappers for website price list ────────────

type ServiceRecord = {
  id: string
  name: string
  gender: CatalogGender | null
  groupKey: string | null
  description: string | null
  price: number
  durationMin: number
  sourceCatalogItemId: string | null
}

/**
 * Map a Service row to CatalogItemDto.
 * Uses sourceCatalogItemId as the DTO id so existing Telegram booking links
 * (which reference CatalogItem) keep working.
 */
export function mapServiceToDto(svc: ServiceRecord): CatalogItemDto {
  return {
    id: svc.sourceCatalogItemId ?? svc.id,
    type: "ZONE",
    gender: svc.gender,
    groupKey: svc.groupKey,
    title: svc.name,
    subtitle: svc.durationMin != null ? `${svc.durationMin} мин` : null,
    description: svc.description,
    sessionsNoteRu: null,
    price: svc.price,
    durationMin: svc.durationMin,
  }
}

type NormalizedPackageRecord = {
  id: string
  name: string
  gender: CatalogGender | null
  description: string | null
  price: number
  durationMin: number
  sourceLegacyPackageId: string | null
}

/**
 * Map a normalized Package row to CatalogItemDto.
 * Uses sourceLegacyPackageId as the DTO id so existing Telegram booking links
 * (which reference CatalogItem PACKAGE) keep working.
 * groupKey is resolved from the source CatalogItem via the provided map.
 */
export function mapNormalizedPackageToDto(
  pkg: NormalizedPackageRecord,
  groupKeyMap: Map<string, string | null>,
): CatalogItemDto {
  const resolvedGroupKey = pkg.sourceLegacyPackageId
    ? (groupKeyMap.get(pkg.sourceLegacyPackageId) ?? "other")
    : "other"
  return {
    id: pkg.sourceLegacyPackageId ?? pkg.id,
    type: "PACKAGE",
    gender: pkg.gender,
    groupKey: resolvedGroupKey,
    title: pkg.name,
    subtitle: pkg.durationMin != null ? `${pkg.durationMin} мин` : null,
    description: pkg.description,
    sessionsNoteRu: null,
    price: pkg.price,
    durationMin: pkg.durationMin,
  }
}

export function buildGroupedCatalogResponse(
  category: CatalogCategorySlug,
  items: CatalogItemDto[],
): CatalogGroupedResponse {
  type GroupKey = string
  const byGenderThenGroup = new Map<
    GenderBucketKey,
    Map<GroupKey, CatalogItemDto[]>
  >()
  const buckets: GenderBucketKey[] = ["female", "male", "unisex"]

  for (const b of buckets) {
    byGenderThenGroup.set(b, new Map())
  }

  for (const item of items) {
    const genderKey = genderToBucketKey(item.gender)
    const groupKey = item.groupKey ?? "other"
    const map = byGenderThenGroup.get(genderKey)!
    if (!map.has(groupKey)) map.set(groupKey, [])
    map.get(groupKey)!.push(item)
  }

  const sections: GroupedSections = {}

  for (const genderKey of buckets) {
    const groupMap = byGenderThenGroup.get(genderKey)!
    const genderSections: Record<string, GroupSection> = {}
    for (const [groupKey, itemList] of groupMap) {
      if (itemList.length === 0) continue
      genderSections[groupKey] = {
        title: groupKeyToTitleRu(groupKey),
        items: itemList,
      }
    }
    if (Object.keys(genderSections).length > 0) {
      sections[genderKey] = genderSections
    }
  }

  return { category, sections }
}

