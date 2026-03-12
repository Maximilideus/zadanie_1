import {
  getCatalogItemById,
  type CatalogItemResponse,
} from "../api/backend.client.js"

const CI_PREFIX = "ci_"

const CATEGORY_LABELS: Record<string, string> = {
  LASER: "Лазерная эпиляция",
  WAX: "Восковая депиляция",
  ELECTRO: "Электроэпиляция",
  MASSAGE: "Массаж",
}

export type DeepLinkResult =
  | { ok: true; item: CatalogItemResponse; serviceId: string }
  | { ok: false; reason: "not_found" | "not_bookable" }

export function parseCatalogPayload(payload: string | undefined): string | null {
  if (!payload || !payload.startsWith(CI_PREFIX)) return null
  const id = payload.slice(CI_PREFIX.length)
  return id.length > 0 ? id : null
}

export async function resolveCatalogDeepLink(catalogItemId: string): Promise<DeepLinkResult> {
  const item = await getCatalogItemById(catalogItemId)
  if (!item || !item.isVisible) {
    return { ok: false, reason: "not_found" }
  }
  if (!item.serviceId || !item.service) {
    return { ok: false, reason: "not_bookable" }
  }
  return { ok: true, item, serviceId: item.serviceId }
}

export function formatCatalogIntro(item: CatalogItemResponse): string {
  const isElectroTime = item.category === "ELECTRO" && item.groupKey === "time"
  const lines = ["Вы выбрали:", ""]
  if (isElectroTime) {
    lines.push("📋 Услуга: Электроэпиляция")
    if (item.durationMin != null) lines.push(`⏱ Длительность: ${item.durationMin} мин`)
  } else {
    const category = CATEGORY_LABELS[item.category] ?? item.category
    lines.push(category)
    lines.push(`Зона: ${item.titleRu}`)
    if (item.durationMin != null) lines.push(`Длительность: ${item.durationMin} мин`)
  }
  if (item.price != null) lines.push(`Цена: ${item.price} ₽`)
  return lines.join("\n")
}
