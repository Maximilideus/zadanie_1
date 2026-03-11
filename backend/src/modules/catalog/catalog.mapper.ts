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
  sessionDurationLabelRu: string | null
  sessionsNoteRu: string | null
  courseTermRu: string | null
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
    sessionDurationLabelRu: null,
    sessionsNoteRu: item.sessionsNoteRu ?? null,
    courseTermRu: null,
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

// ── New website structure: services / packages / subscriptions ────

export type ServiceWebsiteDto = CatalogItemDto

export type PackageWebsiteDto = {
  id: string
  type: "package"
  name: string
  compositionLabel: string
  durationMin: number | null
  price: number | null
  gender: CatalogGender | null
}

export type SubscriptionWebsiteDto = {
  id: string
  type: "subscription"
  name: string
  baseType: "SERVICE" | "PACKAGE"
  baseName: string
  baseCompositionLabel: string | null
  quantity: number
  discountPercent: number
  singleSessionDurationMin: number | null
  totalDurationMin: number | null
  finalPrice: number
  gender: CatalogGender | null
}

export type ServicesGrouped = Partial<
  Record<GenderBucketKey, Record<string, { title: string; items: ServiceWebsiteDto[] }>>
>

export type GenderGrouped<T> = Partial<Record<GenderBucketKey, T[]>>

export type CatalogGroupedResponseV2 = {
  category: CatalogCategorySlug
  services: ServicesGrouped
  packages: GenderGrouped<PackageWebsiteDto>
  subscriptions: GenderGrouped<SubscriptionWebsiteDto>
  /** @deprecated Legacy shape for Telegram bot. Use services/packages/subscriptions. */
  sections: GroupedSections
}

// ── New-model → DTO mappers for website price list ────────────

type ServiceRecord = {
  id: string
  name: string
  gender: CatalogGender | null
  groupKey: string | null
  description: string | null
  sessionDurationLabelRu: string | null
  sessionsNoteRu: string | null
  courseTermRu: string | null
  price: number
  durationMin: number
  sourceCatalogItemId: string | null
}

/**
 * Map a Service row to CatalogItemDto.
 * Uses sourceCatalogItemId as the DTO id so existing Telegram booking links
 * (which reference CatalogItem) keep working.
 * For ELECTRO zone items (groupKey !== "time"): subtitle uses sessionDurationLabelRu for display.
 * For ELECTRO time items: subtitle uses durationMin.
 */
export function mapServiceToDto(svc: ServiceRecord): CatalogItemDto {
  const isElectroZone = svc.groupKey !== "time"
  const subtitle =
    isElectroZone && svc.sessionDurationLabelRu?.trim()
      ? svc.sessionDurationLabelRu
      : svc.durationMin != null
        ? `${svc.durationMin} мин`
        : null
  return {
    id: svc.sourceCatalogItemId ?? svc.id,
    type: "ZONE",
    gender: svc.gender,
    groupKey: svc.groupKey,
    title: svc.name,
    subtitle,
    description: svc.description,
    sessionDurationLabelRu: svc.sessionDurationLabelRu ?? null,
    sessionsNoteRu: svc.sessionsNoteRu ?? null,
    courseTermRu: svc.courseTermRu ?? null,
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
    sessionDurationLabelRu: null,
    sessionsNoteRu: null,
    courseTermRu: null,
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

// ── Package → PackageWebsiteDto ───────────────────────────────────

type PackageRecordWithServices = {
  id: string
  name: string
  gender: CatalogGender | null
  price: number
  durationMin: number
  sourceLegacyPackageId: string | null
  services: { service: { name: string } }[]
}

export function mapPackageToWebsiteDto(
  pkg: PackageRecordWithServices,
): PackageWebsiteDto {
  const compositionLabel =
    pkg.services.length > 0
      ? pkg.services.map((s) => s.service.name).join(" + ")
      : pkg.name
  return {
    id: pkg.sourceLegacyPackageId ?? pkg.id,
    type: "package",
    name: pkg.name,
    compositionLabel,
    durationMin: pkg.durationMin,
    price: pkg.price,
    gender: pkg.gender,
  }
}

// ── Subscription → SubscriptionWebsiteDto ────────────────────────

type SubscriptionRecord = {
  id: string
  name: string
  gender: CatalogGender | null
  quantity: number
  discountPercent: number
  finalPrice: number
  baseServiceId: string | null
  basePackageId: string | null
  baseService: { name: string; durationMin: number } | null
  basePackage: {
    name: string
    durationMin: number
    services: { service: { name: string } }[]
  } | null
}

export function mapSubscriptionToWebsiteDto(
  sub: SubscriptionRecord,
): SubscriptionWebsiteDto {
  const baseType = sub.baseServiceId ? "SERVICE" : "PACKAGE"
  const baseName = sub.baseService?.name ?? sub.basePackage?.name ?? ""
  const baseCompositionLabel =
    sub.basePackage?.services?.length
      ? sub.basePackage.services.map((s) => s.service.name).join(" + ")
      : null
  const singleSessionDurationMin =
    sub.baseService?.durationMin ?? sub.basePackage?.durationMin ?? null
  const totalDurationMin =
    singleSessionDurationMin != null
      ? singleSessionDurationMin * sub.quantity
      : null

  return {
    id: sub.id,
    type: "subscription",
    name: sub.name,
    baseType,
    baseName,
    baseCompositionLabel,
    quantity: sub.quantity,
    discountPercent: sub.discountPercent,
    singleSessionDurationMin,
    totalDurationMin,
    finalPrice: sub.finalPrice,
    gender: sub.gender,
  }
}

// ── Build V2 grouped response ────────────────────────────────────

export function buildCatalogGroupedResponseV2(
  category: CatalogCategorySlug,
  serviceItems: CatalogItemDto[],
  packages: PackageWebsiteDto[],
  subscriptions: SubscriptionWebsiteDto[],
): CatalogGroupedResponseV2 {
  const buckets: GenderBucketKey[] = ["female", "male", "unisex"]

  const servicesGrouped: ServicesGrouped = {}
  for (const b of buckets) {
    servicesGrouped[b] = {}
  }
  for (const item of serviceItems) {
    const genderKey = genderToBucketKey(item.gender)
    const groupKey = item.groupKey ?? "other"
    const map = servicesGrouped[genderKey]!
    if (!map[groupKey]) map[groupKey] = { title: groupKeyToTitleRu(groupKey), items: [] }
    map[groupKey].items.push(item)
  }

  const packagesGrouped: GenderGrouped<PackageWebsiteDto> = {}
  for (const b of buckets) {
    packagesGrouped[b] = []
  }
  for (const pkg of packages) {
    const genderKey = genderToBucketKey(pkg.gender)
    packagesGrouped[genderKey]!.push(pkg)
  }

  const subscriptionsGrouped: GenderGrouped<SubscriptionWebsiteDto> = {}
  for (const b of buckets) {
    subscriptionsGrouped[b] = []
  }
  for (const sub of subscriptions) {
    const genderKey = genderToBucketKey(sub.gender)
    subscriptionsGrouped[genderKey]!.push(sub)
  }

  const legacyItems: CatalogItemDto[] = [
    ...serviceItems,
    ...packages.map((p) => ({
      id: p.id,
      type: "PACKAGE" as const,
      gender: p.gender,
      groupKey: "other" as string | null,
      title: p.name,
      subtitle: p.durationMin != null ? `${p.durationMin} мин` : null,
      description: p.compositionLabel,
      sessionDurationLabelRu: null,
      sessionsNoteRu: null,
      courseTermRu: null,
      price: p.price,
      durationMin: p.durationMin,
    })),
  ]
  const sections = buildGroupedCatalogResponse(category, legacyItems).sections

  return {
    category,
    services: servicesGrouped,
    packages: packagesGrouped,
    subscriptions: subscriptionsGrouped,
    sections,
  }
}

