import { prisma } from "../../lib/prisma"
import type { CatalogCategory } from "@prisma/client"

export async function findCatalogItemById(id: string) {
  return prisma.catalogItem.findUnique({
    where: { id },
    select: {
      id: true,
      category: true,
      type: true,
      gender: true,
      groupKey: true,
      titleRu: true,
      subtitleRu: true,
      descriptionRu: true,
      price: true,
      durationMin: true,
      serviceId: true,
      isVisible: true,
      service: {
        select: { id: true, name: true, durationMin: true, price: true },
      },
    },
  })
}

export async function getDefaultLocationId() {
  const location = await prisma.location.findFirst({
    select: { id: true },
  })

  if (!location) {
    throw new Error("NO_LOCATION_CONFIGURED")
  }

  return location.id
}

export async function findCatalogItemsByLocationAndCategory(
  locationId: string,
  category: CatalogCategory,
) {
  return prisma.catalogItem.findMany({
    where: {
      locationId,
      category,
      isVisible: true,
    },
    orderBy: [
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      type: true,
      gender: true,
      groupKey: true,
      titleRu: true,
      subtitleRu: true,
      descriptionRu: true,
      price: true,
      durationMin: true,
    },
  })
}

