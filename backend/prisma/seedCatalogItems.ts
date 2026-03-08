import type { PrismaClient } from "@prisma/client"
import { Prisma, CatalogCategory, CatalogItemType, CatalogGender } from "@prisma/client"

// ── Service resolution logic (same rules as linkCatalogItemsToServices) ──

function resolveLaserServiceName(durationMin: number): string {
  if (durationMin <= 15) return "Laser 15 min"
  if (durationMin <= 30) return "Laser 30 min"
  if (durationMin <= 45) return "Laser 45 min"
  if (durationMin <= 60) return "Laser 60 min"
  if (durationMin <= 90) return "Laser 90 min"
  return "Laser 120 min"
}

function resolveWaxServiceName(durationMin: number): string {
  if (durationMin <= 15) return "Waxing 15 min"
  if (durationMin <= 25) return "Waxing 25 min"
  if (durationMin <= 35) return "Waxing 35 min"
  if (durationMin <= 50) return "Waxing 50 min"
  return "Waxing 60 min"
}

const ELECTRO_DURATION_MAP: Record<number, string> = {
  15: "Electro 15 min",
  30: "Electro 30 min",
  45: "Electro 45 min",
  60: "Electro 60 min",
  90: "Electro 90 min",
  120: "Electro 120 min",
}

const MASSAGE_TITLE_MAP: [RegExp, string][] = [
  [/Classic|Классический/i, "Massage Classic 60 min"],
  [/Relax|Расслабляющий/i, "Massage Relax 60 min"],
  [/Sport|Спортивный/i, "Massage Sport 60 min"],
  [/Lymph|Лимфодренажный/i, "Massage Lymph 60 min"],
]

interface CatalogItemDef {
  category: CatalogCategory
  type: CatalogItemType
  gender: CatalogGender | null
  groupKey: string
  titleRu: string
  subtitleRu: string | null
  price: number | null
  durationMin: number | null
  descriptionRu?: string | null
}

function resolveServiceName(item: CatalogItemDef): string | null {
  const { category, type, groupKey, titleRu, durationMin } = item

  switch (category) {
    case CatalogCategory.LASER:
      return durationMin != null ? resolveLaserServiceName(durationMin) : null

    case CatalogCategory.WAX:
      return durationMin != null ? resolveWaxServiceName(durationMin) : null

    case CatalogCategory.ELECTRO:
      if (type === CatalogItemType.OFFER && groupKey === "time") {
        if (durationMin == null) return null
        return ELECTRO_DURATION_MAP[durationMin] ?? null
      }
      if (groupKey === "face" || groupKey === "body") {
        return "Electro 15 min"
      }
      return null

    case CatalogCategory.MASSAGE:
      for (const [pattern, serviceName] of MASSAGE_TITLE_MAP) {
        if (pattern.test(titleRu)) return serviceName
      }
      return null

    default:
      return null
  }
}

// ── Seed data ────────────────────────────────────────────────────────────

const CATALOG_ITEMS: CatalogItemDef[] = [
  // WAX FEMALE face
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "face", titleRu: "Верхняя губа", subtitleRu: "5 мин", price: 400, durationMin: 5 },
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "face", titleRu: "Подбородок", subtitleRu: "5 мин", price: 500, durationMin: 5 },
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "face", titleRu: "Лицо полностью", subtitleRu: "25 мин", price: 1800, durationMin: 25 },
  // WAX FEMALE body
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "body", titleRu: "Подмышки", subtitleRu: "10 мин", price: 700, durationMin: 10 },
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "body", titleRu: "Предплечья", subtitleRu: "20 мин", price: 1200, durationMin: 20 },
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "body", titleRu: "Руки полностью", subtitleRu: "30 мин", price: 1800, durationMin: 30 },
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "body", titleRu: "Голени", subtitleRu: "25 мин", price: 1400, durationMin: 25 },
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "body", titleRu: "Бёдра", subtitleRu: "25 мин", price: 1600, durationMin: 25 },
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "body", titleRu: "Ноги полностью", subtitleRu: "45 мин", price: 2800, durationMin: 45 },
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "body", titleRu: "Живот (линия)", subtitleRu: "5 мин", price: 500, durationMin: 5 },
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "body", titleRu: "Живот полностью", subtitleRu: "20 мин", price: 1400, durationMin: 20 },
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "body", titleRu: "Спина полностью", subtitleRu: "35 мин", price: 2200, durationMin: 35 },
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "body", titleRu: "Ягодицы", subtitleRu: "20 мин", price: 1600, durationMin: 20 },
  // WAX FEMALE intimate
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "intimate", titleRu: "Бикини классическое", subtitleRu: "15 мин", price: 1200, durationMin: 15 },
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "intimate", titleRu: "Бикини глубокое", subtitleRu: "25 мин", price: 1800, durationMin: 25 },
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "intimate", titleRu: "Тотальное бикини", subtitleRu: "35 мин", price: 2400, durationMin: 35 },
  // WAX MALE face
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "face", titleRu: "Шея / контур бороды", subtitleRu: "15 мин", price: 1000, durationMin: 15 },
  // WAX MALE body
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "body", titleRu: "Подмышки", subtitleRu: "15 мин", price: 1000, durationMin: 15 },
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "body", titleRu: "Спина полностью", subtitleRu: "50 мин", price: 3500, durationMin: 50 },
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "body", titleRu: "Плечи", subtitleRu: "30 мин", price: 2000, durationMin: 30 },
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "body", titleRu: "Грудь", subtitleRu: "35 мин", price: 2200, durationMin: 35 },
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "body", titleRu: "Живот", subtitleRu: "25 мин", price: 1800, durationMin: 25 },
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "body", titleRu: "Ягодицы", subtitleRu: "30 мин", price: 2000, durationMin: 30 },
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "body", titleRu: "Голени", subtitleRu: "30 мин", price: 2000, durationMin: 30 },
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "body", titleRu: "Ноги полностью", subtitleRu: "60 мин", price: 3800, durationMin: 60 },
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "body", titleRu: "Руки полностью", subtitleRu: "35 мин", price: 2400, durationMin: 35 },
  // WAX MALE intimate
  { category: CatalogCategory.WAX, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "intimate", titleRu: "Интимная зона (мужская)", subtitleRu: "30 мин", price: 2000, durationMin: 30 },
  // LASER FEMALE face
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "face", titleRu: "Верхняя губа", subtitleRu: "5 мин", price: 800, durationMin: 5 },
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "face", titleRu: "Подбородок", subtitleRu: "5 мин", price: 900, durationMin: 5 },
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "face", titleRu: "Щёки и скулы", subtitleRu: "10 мин", price: 1400, durationMin: 10 },
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "face", titleRu: "Лицо полностью", subtitleRu: "20 мин", price: 2800, durationMin: 20 },
  // LASER FEMALE body
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "body", titleRu: "Подмышки", subtitleRu: "10 мин", price: 1500, durationMin: 10 },
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "body", titleRu: "Предплечья", subtitleRu: "15 мин", price: 2200, durationMin: 15 },
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "body", titleRu: "Руки полностью", subtitleRu: "20 мин", price: 3200, durationMin: 20 },
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "body", titleRu: "Голени", subtitleRu: "20 мин", price: 2800, durationMin: 20 },
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "body", titleRu: "Бёдра", subtitleRu: "25 мин", price: 3200, durationMin: 25 },
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "body", titleRu: "Ноги полностью", subtitleRu: "40 мин", price: 5500, durationMin: 40 },
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "body", titleRu: "Живот (линия)", subtitleRu: "10 мин", price: 1200, durationMin: 10 },
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "body", titleRu: "Живот полностью", subtitleRu: "20 мин", price: 2800, durationMin: 20 },
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "body", titleRu: "Спина полностью", subtitleRu: "30 мин", price: 4500, durationMin: 30 },
  // LASER FEMALE intimate
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "intimate", titleRu: "Бикини классическое", subtitleRu: "15 мин", price: 2000, durationMin: 15 },
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "intimate", titleRu: "Бикини глубокое", subtitleRu: "20 мин", price: 3200, durationMin: 20 },
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.FEMALE, groupKey: "intimate", titleRu: "Тотальное бикини", subtitleRu: "30 мин", price: 4500, durationMin: 30 },
  // LASER MALE face
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "face", titleRu: "Борода (контур / шея)", subtitleRu: "15 мин", price: 2000, durationMin: 15 },
  // LASER MALE body
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "body", titleRu: "Подмышки", subtitleRu: "10 мин", price: 1800, durationMin: 10 },
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "body", titleRu: "Спина полностью", subtitleRu: "45 мин", price: 6500, durationMin: 45 },
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "body", titleRu: "Плечи", subtitleRu: "25 мин", price: 3500, durationMin: 25 },
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "body", titleRu: "Грудь", subtitleRu: "30 мин", price: 4000, durationMin: 30 },
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "body", titleRu: "Живот", subtitleRu: "20 мин", price: 3200, durationMin: 20 },
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "body", titleRu: "Ягодицы", subtitleRu: "25 мин", price: 3500, durationMin: 25 },
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "body", titleRu: "Голени", subtitleRu: "25 мин", price: 3800, durationMin: 25 },
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "body", titleRu: "Ноги полностью", subtitleRu: "55 мин", price: 7500, durationMin: 55 },
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "body", titleRu: "Руки полностью", subtitleRu: "30 мин", price: 4500, durationMin: 30 },
  // LASER MALE intimate
  { category: CatalogCategory.LASER, type: CatalogItemType.ZONE, gender: CatalogGender.MALE, groupKey: "intimate", titleRu: "Интимная зона (мужская)", subtitleRu: "20 мин", price: 3500, durationMin: 20 },
  // ELECTRO face zones
  { category: CatalogCategory.ELECTRO, type: CatalogItemType.INFO, gender: CatalogGender.UNISEX, groupKey: "face", titleRu: "Верхняя губа", subtitleRu: null, price: 900, durationMin: 15 },
  { category: CatalogCategory.ELECTRO, type: CatalogItemType.INFO, gender: CatalogGender.UNISEX, groupKey: "face", titleRu: "Подбородок", subtitleRu: null, price: 900, durationMin: 15 },
  { category: CatalogCategory.ELECTRO, type: CatalogItemType.INFO, gender: CatalogGender.UNISEX, groupKey: "face", titleRu: "Щёки / скулы", subtitleRu: null, price: 900, durationMin: 15 },
  { category: CatalogCategory.ELECTRO, type: CatalogItemType.INFO, gender: CatalogGender.UNISEX, groupKey: "face", titleRu: "Брови", subtitleRu: null, price: 900, durationMin: 15 },
  { category: CatalogCategory.ELECTRO, type: CatalogItemType.INFO, gender: CatalogGender.UNISEX, groupKey: "face", titleRu: "Шея", subtitleRu: null, price: 900, durationMin: 15 },
  // ELECTRO body zones
  { category: CatalogCategory.ELECTRO, type: CatalogItemType.INFO, gender: CatalogGender.UNISEX, groupKey: "body", titleRu: "Ареолы", subtitleRu: null, price: 900, durationMin: 15 },
  { category: CatalogCategory.ELECTRO, type: CatalogItemType.INFO, gender: CatalogGender.UNISEX, groupKey: "body", titleRu: "Белая линия живота", subtitleRu: null, price: 900, durationMin: 15 },
  { category: CatalogCategory.ELECTRO, type: CatalogItemType.INFO, gender: CatalogGender.UNISEX, groupKey: "body", titleRu: "Пальцы рук / ног", subtitleRu: null, price: 900, durationMin: 15 },
  { category: CatalogCategory.ELECTRO, type: CatalogItemType.INFO, gender: CatalogGender.UNISEX, groupKey: "body", titleRu: "Единичные волосы", subtitleRu: null, price: 900, durationMin: 15 },
  // ELECTRO INFO other
  { category: CatalogCategory.ELECTRO, type: CatalogItemType.INFO, gender: CatalogGender.UNISEX, groupKey: "info", titleRu: "Финальная доработка после лазера", subtitleRu: null, price: null, durationMin: null },
  // ELECTRO TIME offers
  { category: CatalogCategory.ELECTRO, type: CatalogItemType.OFFER, gender: CatalogGender.UNISEX, groupKey: "time", titleRu: "15 минут", subtitleRu: null, price: 900, durationMin: 15 },
  { category: CatalogCategory.ELECTRO, type: CatalogItemType.OFFER, gender: CatalogGender.UNISEX, groupKey: "time", titleRu: "30 минут", subtitleRu: null, price: 1700, durationMin: 30 },
  { category: CatalogCategory.ELECTRO, type: CatalogItemType.OFFER, gender: CatalogGender.UNISEX, groupKey: "time", titleRu: "45 минут", subtitleRu: null, price: 2400, durationMin: 45 },
  { category: CatalogCategory.ELECTRO, type: CatalogItemType.OFFER, gender: CatalogGender.UNISEX, groupKey: "time", titleRu: "60 минут", subtitleRu: null, price: 3000, durationMin: 60 },
  { category: CatalogCategory.ELECTRO, type: CatalogItemType.OFFER, gender: CatalogGender.UNISEX, groupKey: "time", titleRu: "90 минут", subtitleRu: null, price: 4200, durationMin: 90 },
  { category: CatalogCategory.ELECTRO, type: CatalogItemType.OFFER, gender: CatalogGender.UNISEX, groupKey: "time", titleRu: "120 минут", subtitleRu: null, price: 5200, durationMin: 120 },
  // MASSAGE
  { category: CatalogCategory.MASSAGE, type: CatalogItemType.OFFER, gender: CatalogGender.UNISEX, groupKey: "massage", titleRu: "Классический массаж", subtitleRu: "60 мин", price: 2000, durationMin: 60 },
  { category: CatalogCategory.MASSAGE, type: CatalogItemType.OFFER, gender: CatalogGender.UNISEX, groupKey: "massage", titleRu: "Расслабляющий массаж", subtitleRu: "60 мин", price: 2000, durationMin: 60 },
  { category: CatalogCategory.MASSAGE, type: CatalogItemType.OFFER, gender: CatalogGender.UNISEX, groupKey: "massage", titleRu: "Спортивный массаж", subtitleRu: "60 мин", price: 2200, durationMin: 60 },
  { category: CatalogCategory.MASSAGE, type: CatalogItemType.OFFER, gender: CatalogGender.UNISEX, groupKey: "massage", titleRu: "Лимфодренажный массаж", subtitleRu: "60 мин", price: 2200, durationMin: 60 },
]

// ── Main seed function ──────────────────────────────────────────────────

export async function seedCatalogItems(prisma: PrismaClient) {
  const location = await prisma.location.findFirst({ select: { id: true } })
  if (!location) {
    throw new Error("No Location found. Create at least one Location before seeding CatalogItem.")
  }

  const services = await prisma.service.findMany({
    where: { locationId: location.id },
    select: { id: true, name: true },
  })
  const serviceByName = new Map(services.map((s) => [s.name, s.id]))

  if (serviceByName.size === 0) {
    throw new Error(
      "[seedCatalogItems] FATAL: No Service records found. " +
      "Services must be created before CatalogItems. Seed aborted."
    )
  }

  // Phase 1: resolve all service links, fail fast if any bookable item can't resolve
  const errors: string[] = []
  let sortOrder = 0
  let linked = 0
  let infoOnly = 0

  const rows: Prisma.CatalogItemCreateManyInput[] = CATALOG_ITEMS.map((item) => {
    const serviceName = resolveServiceName(item)

    let serviceId: string | null = null

    if (serviceName) {
      const resolved = serviceByName.get(serviceName)
      if (!resolved) {
        errors.push(
          `"${item.titleRu}" (${item.category}/${item.groupKey}) needs Service "${serviceName}" but it does not exist`
        )
      } else {
        serviceId = resolved
        linked++
      }
    } else {
      infoOnly++
    }

    return {
      locationId: location.id,
      category: item.category,
      type: item.type,
      gender: item.gender,
      groupKey: item.groupKey,
      titleRu: item.titleRu,
      subtitleRu: item.subtitleRu,
      descriptionRu: item.descriptionRu ?? null,
      price: item.price,
      durationMin: item.durationMin,
      serviceId,
      isVisible: true,
      sortOrder: ++sortOrder,
    }
  })

  if (errors.length > 0) {
    throw new Error(
      `[seedCatalogItems] FATAL: ${errors.length} bookable items cannot resolve their Service.\n` +
      errors.map((e) => `  - ${e}`).join("\n") +
      "\nSeed aborted. No CatalogItem rows were modified."
    )
  }

  // Phase 2: all validations passed — safe to write
  await prisma.catalogItem.deleteMany({ where: { locationId: location.id } })
  await prisma.catalogItem.createMany({ data: rows })

  // Phase 3: post-write integrity check
  const nullServiceBookable = await prisma.catalogItem.count({
    where: {
      locationId: location.id,
      isVisible: true,
      serviceId: null,
      price: { not: null },
      durationMin: { not: null },
    },
  })

  if (nullServiceBookable > 0) {
    console.error(
      `[seedCatalogItems] WARNING: ${nullServiceBookable} visible items with price+duration have null serviceId!`
    )
  }

  console.log(
    `[seedCatalogItems] ${rows.length} items created, ` +
    `${linked} linked to services, ${infoOnly} info-only (no service needed)`
  )
}
