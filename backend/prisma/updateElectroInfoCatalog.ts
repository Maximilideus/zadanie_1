import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const ELECTRO_INFO_DATA: { titleRu: string; subtitleRu: string; descriptionRu: string }[] = [
  { titleRu: "Верхняя губа",                   subtitleRu: "15–30 мин / сеанс", descriptionRu: "8–12 сеансов" },
  { titleRu: "Подбородок",                     subtitleRu: "20–40 мин / сеанс", descriptionRu: "10–15 сеансов" },
  { titleRu: "Щёки / скулы",                   subtitleRu: "30–60 мин / сеанс", descriptionRu: "10–15 сеансов" },
  { titleRu: "Брови",                          subtitleRu: "15–20 мин / сеанс", descriptionRu: "6–10 сеансов" },
  { titleRu: "Шея",                            subtitleRu: "20–40 мин / сеанс", descriptionRu: "8–12 сеансов" },
  { titleRu: "Ареолы",                         subtitleRu: "15–25 мин / сеанс", descriptionRu: "6–10 сеансов" },
  { titleRu: "Белая линия живота",             subtitleRu: "15–20 мин / сеанс", descriptionRu: "6–8 сеансов" },
  { titleRu: "Пальцы рук / ног",              subtitleRu: "10–20 мин / сеанс", descriptionRu: "6–8 сеансов" },
  { titleRu: "Единичные волосы",               subtitleRu: "15–30 мин / сеанс", descriptionRu: "5–8 сеансов" },
  { titleRu: "Финальная доработка после лазера", subtitleRu: "По факту",         descriptionRu: "Индивидуально" },
]

async function main() {
  const infoItems = await prisma.catalogItem.findMany({
    where: { category: "ELECTRO", type: "INFO" },
    select: { id: true, titleRu: true, subtitleRu: true, descriptionRu: true },
  })

  const byTitle = new Map(infoItems.map((item) => [item.titleRu, item]))

  let updated = 0
  let notFound = 0

  for (const entry of ELECTRO_INFO_DATA) {
    const existing = byTitle.get(entry.titleRu)
    if (!existing) {
      notFound++
      console.warn(`[NOT FOUND] No ELECTRO INFO row with titleRu = "${entry.titleRu}"`)
      continue
    }

    if (existing.subtitleRu === entry.subtitleRu && existing.descriptionRu === entry.descriptionRu) {
      continue
    }

    await prisma.catalogItem.update({
      where: { id: existing.id },
      data: { subtitleRu: entry.subtitleRu, descriptionRu: entry.descriptionRu },
    })
    updated++
  }

  console.log("\n=== Update ELECTRO INFO summary ===")
  console.log(`Total entries to update: ${ELECTRO_INFO_DATA.length}`)
  console.log(`Updated:    ${updated}`)
  console.log(`Not found:  ${notFound}`)
  console.log(`Already OK: ${ELECTRO_INFO_DATA.length - updated - notFound}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
