/**
 * ELECTRO zone services (informational only, e.g. "Верхняя губа", "Подбородок")
 * must NOT be bookable. Only ELECTRO time services (groupKey === "time") can be booked.
 */
export const ELECTRO_ZONE_NOT_BOOKABLE = "ELECTRO_ZONE_NOT_BOOKABLE"

export function assertElectroServiceBookable(service: {
  category: string | null
  groupKey: string | null
}): void {
  if (service.category === "ELECTRO" && service.groupKey !== "time") {
    throw new Error(ELECTRO_ZONE_NOT_BOOKABLE)
  }
}
