import type { Prisma } from "@prisma/client"

/**
 * Prisma where clause to filter for bookable services only.
 *
 * Business rule:
 * - category != "ELECTRO" → all normal business services (LASER, WAX, MASSAGE)
 * - category = "ELECTRO" AND groupKey = "time" → ELECTRO time-based booking services
 *
 * ELECTRO informational zones (groupKey = face/body/intimate/etc.) are excluded.
 */
export function whereBookableService(): Prisma.ServiceWhereInput {
  return {
    OR: [
      { category: { not: "ELECTRO" } },
      { category: "ELECTRO", groupKey: "time" },
    ],
  }
}
