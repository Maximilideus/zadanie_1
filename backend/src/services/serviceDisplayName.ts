/**
 * Client-facing service name (Russian). Mirrors telegram-bot formatServiceNameOnly
 * so API responses do not expose internal names like "Electro 15 min".
 */
const MASSAGE_SUBTYPE_RU: Record<string, string> = {
  Lymph: "Лимфодренажный массаж",
  Relax: "Релакс-массаж",
  Sport: "Спортивный массаж",
  Classic: "Классический массаж",
}

export function getServiceDisplayName(internalName: string): string {
  const raw = (internalName ?? "").trim()
  if (raw.startsWith("Waxing")) return "Восковая депиляция"
  if (raw.startsWith("Laser")) return "Лазерная эпиляция"
  if (raw.startsWith("Electro")) return "Электроэпиляция"
  if (raw.startsWith("Massage")) {
    const subtype = raw
      .replace(/^Massage\s+/, "")
      .replace(/\s+\d+\s*min\s*$/i, "")
      .trim()
    return subtype && MASSAGE_SUBTYPE_RU[subtype]
      ? MASSAGE_SUBTYPE_RU[subtype]
      : subtype
        ? `Массаж ${subtype}`
        : "Массаж"
  }
  const withoutMin = raw.replace(/\s+\d+\s*min\s*$/i, "").trim()
  return withoutMin || raw
}
