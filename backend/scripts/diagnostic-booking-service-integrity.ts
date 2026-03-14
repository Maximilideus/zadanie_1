/**
 * PRODUCTION-SAFE READ-ONLY DIAGNOSTIC
 * Finds suspicious Service rows and Bookings linked to them.
 * Does NOT modify any data.
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Russian zone-like names (from seed-electro-zone-services and catalog)
const RUSSIAN_ZONE_LIKE = [
  "Верхняя губа",
  "Подбородок",
  "Щёки / скулы",
  "Брови",
  "Шея",
  "Ареолы",
  "Белая линия живота",
  "Пальцы рук / ног",
  "Единичные волосы",
  "Подмышки",
  "Предплечья",
  "Руки полностью",
  "Голени",
  "Бёдра",
  "Ноги полностью",
  "Живот",
  "Живот полностью",
  "Спина полностью",
  "Плечи",
  "Грудь",
  "Ягодицы",
  "Бикини классическое",
  "Бикини глубокое",
  "Тотальное бикини",
  "Интимная зона (мужская)",
  "Лицо полностью",
  "Щёки и скулы",
  "Борода (контур / шея)",
  "Шея / контур бороды",
]

// Duration labels in Russian (catalog titleRu for ELECTRO time)
const DURATION_LABELS_RU = [
  "15 минут",
  "30 минут",
  "45 минут",
  "60 минут",
  "90 минут",
  "120 минут",
]

function isRussianZoneName(name: string): boolean {
  const n = name.trim()
  return RUSSIAN_ZONE_LIKE.some((z) => z === n || n.includes(z))
}

function isDurationLabel(name: string): boolean {
  const n = name.trim()
  return DURATION_LABELS_RU.includes(n) || /\d+\s*минут/i.test(n)
}

function looksLikeInternalElectroTime(name: string): boolean {
  return /^Electro\s+\d+\s*min$/i.test(name.trim())
}

async function main() {
  console.log("=== DIAGNOSTIC: Suspicious Service rows and linked Bookings ===\n")

  const allServices = await prisma.service.findMany({
    select: {
      id: true,
      name: true,
      category: true,
      groupKey: true,
      durationMin: true,
      isBookable: true,
      showInBot: true,
      showOnWebsite: true,
      isVisible: true,
      locationId: true,
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  })

  const suspicious: typeof allServices = []
  const reasons: Record<string, string[]> = {}

  for (const s of allServices) {
    const r: string[] = []
    if (s.name.includes("минут") || isDurationLabel(s.name)) r.push("name_like_duration_label")
    if (isRussianZoneName(s.name)) r.push("name_russian_zone")
    if (s.category === "ELECTRO" && s.groupKey !== "time" && s.groupKey != null) {
      if (s.isBookable) r.push("electro_zone_but_bookable")
      else r.push("electro_display_only_zone")
    }
    if (s.category === "ELECTRO" && s.groupKey === "time" && !looksLikeInternalElectroTime(s.name))
      r.push("electro_time_but_bad_name")
    if (s.isBookable === false) r.push("not_bookable")
    if (s.showInBot === false) r.push("show_in_bot_false")
    if (r.length) {
      suspicious.push(s)
      reasons[s.id] = r
    }
  }

  console.log("--- SECTION 2: Suspicious Service rows ---\n")
  console.log("Total Service rows:", allServices.length)
  console.log("Suspicious Service rows:", suspicious.length, "\n")

  for (const s of suspicious) {
    console.log("Service id:", s.id)
    console.log("  name:", JSON.stringify(s.name))
    console.log("  category:", s.category)
    console.log("  groupKey:", s.groupKey)
    console.log("  durationMin:", s.durationMin)
    console.log("  isBookable:", s.isBookable)
    console.log("  showInBot:", s.showInBot)
    console.log("  showOnWebsite:", s.showOnWebsite)
    console.log("  reasons:", reasons[s.id].join(", "))
    console.log("")
  }

  const suspiciousIds = suspicious.map((s) => s.id)
  const bookingsLinked = await prisma.booking.findMany({
    where: { serviceId: { in: suspiciousIds } },
    select: {
      id: true,
      createdAt: true,
      status: true,
      source: true,
      serviceId: true,
      customerId: true,
      userId: true,
      scheduledAt: true,
    },
    orderBy: { createdAt: "desc" },
  })

  console.log("--- SECTION 3: Bookings linked to suspicious Services ---\n")
  console.log("Total such Bookings:", bookingsLinked.length, "\n")

  const byService = new Map<string, typeof bookingsLinked>()
  for (const b of bookingsLinked) {
    if (b.serviceId) {
      if (!byService.has(b.serviceId)) byService.set(b.serviceId, [])
      byService.get(b.serviceId)!.push(b)
    }
  }

  for (const s of suspicious) {
    const list = byService.get(s.id) ?? []
    if (list.length === 0) continue
    console.log("Service:", s.id, "name:", JSON.stringify(s.name))
    for (const b of list) {
      console.log("  Booking id:", b.id)
      console.log("    createdAt:", b.createdAt)
      console.log("    status:", b.status)
      console.log("    source:", b.source)
      console.log("    serviceId:", b.serviceId)
      console.log("    customerId:", b.customerId)
      console.log("    userId:", b.userId)
    }
    console.log("")
  }

  // Non-suspicious services that have bookings (for "good" example)
  const bookableServiceIds = new Set(
    (await prisma.booking.findMany({ where: { serviceId: { not: null } }, select: { serviceId: true } }))
      .map((b) => b.serviceId)
      .filter(Boolean) as string[]
  )
  const goodExamples = allServices.filter(
    (s) => bookableServiceIds.has(s.id) && !suspiciousIds.includes(s.id) && looksLikeInternalElectroTime(s.name)
  )
  const goodLaserWax = allServices.filter(
    (s) =>
      bookableServiceIds.has(s.id) &&
      !suspiciousIds.includes(s.id) &&
      (s.name.startsWith("Laser ") || s.name.startsWith("Waxing "))
  )

  console.log("--- SECTION 7 (examples): Services with bookings ---\n")
  console.log("Good example (internal name, has booking):")
  if (goodExamples.length) {
    const g = goodExamples[0]
    console.log("  Service id:", g.id, "name:", JSON.stringify(g.name), "category:", g.category)
  } else if (goodLaserWax.length) {
    const g = goodLaserWax[0]
    console.log("  Service id:", g.id, "name:", JSON.stringify(g.name), "category:", g.category)
  }
  console.log("")
  console.log("Suspicious and linked to Booking:")
  const badLinked = suspicious.filter((s) => (byService.get(s.id)?.length ?? 0) > 0)
  for (const s of badLinked.slice(0, 3)) {
    console.log("  Service id:", s.id, "name:", JSON.stringify(s.name), "bookings:", byService.get(s.id)?.length ?? 0)
  }
  console.log("")
  console.log("Display-only (electro zone, isBookable=false):")
  const displayOnly = suspicious.filter((s) => s.isBookable === false && s.category === "ELECTRO")
  for (const s of displayOnly.slice(0, 2)) {
    console.log("  Service id:", s.id, "name:", JSON.stringify(s.name), "linked bookings:", byService.get(s.id)?.length ?? 0)
  }

  // LASER / WAX / MASSAGE: any booking linked to a service whose name is zone/duration/display?
  const laserWaxMassageBookings = await prisma.booking.findMany({
    where: { serviceId: { not: null } },
    include: {
      service: {
        select: { id: true, name: true, category: true, groupKey: true },
      },
    },
  })
  const otherCategoryBad = laserWaxMassageBookings.filter((b) => {
    const svc = b.service
    if (!svc) return false
    if (svc.category === "ELECTRO") return false
    return isRussianZoneName(svc.name) || isDurationLabel(svc.name)
  })

  console.log("\n--- SECTION 6: LASER/WAX/MASSAGE bookings with zone/duration name ---")
  console.log("Count:", otherCategoryBad.length)
  for (const b of otherCategoryBad.slice(0, 10)) {
    console.log("  Booking:", b.id, "Service name:", JSON.stringify(b.service?.name))
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
