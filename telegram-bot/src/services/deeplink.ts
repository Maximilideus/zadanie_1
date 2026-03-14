import {
  getCatalogItemById,
  type CatalogItemResponse,
} from "../api/backend.client.js"
import { normalizeCategory } from "./formatters.js"

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

/**
 * Unified catalog intro for "Вы выбрали" block. Used by deep link and catalog flow.
 * Style: procedure type (📋), zone (📍) only for LASER/WAX/MASSAGE, duration (⏱), price (💳).
 * ELECTRO: never show zone line (time-based only).
 */
export function formatCatalogIntro(item: CatalogItemResponse): string {
  const cat = normalizeCategory(item.category)
  const procedureType = (cat && CATEGORY_LABELS[cat]) ?? item.category
  const lines = ["Вы выбрали", ""]
  lines.push(`📋 ${procedureType}`)
  if (cat !== "ELECTRO" && item.titleRu) lines.push(`📍 ${item.titleRu}`)
  if (item.durationMin != null) lines.push(`⏱ ${item.durationMin} мин`)
  if (item.price != null) lines.push(`💳 ${item.price.toLocaleString("ru-RU")} ₽`)
  return lines.join("\n")
}
