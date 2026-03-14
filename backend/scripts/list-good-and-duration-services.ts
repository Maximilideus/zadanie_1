import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
async function main() {
  const all = await p.service.findMany({ select: { id: true, name: true, category: true, groupKey: true } })
  const hasCyrillic = (s: string) => /[\u0400-\u04FF]/.test(s)
  const good = all.filter(
    (s) =>
      !s.name.includes("минут") &&
      !hasCyrillic(s.name) &&
      !(s.category === "ELECTRO" && s.groupKey !== "time" && s.groupKey != null)
  )
  console.log("Non-suspicious Service count:", good.length)
  good.forEach((s) => console.log(" ", s.name, s.category))
  const durationNamed = all.filter((s) => s.name.includes("минут"))
  console.log("\nServices with name containing 'минут':")
  durationNamed.forEach((s) => console.log(" ", JSON.stringify(s)))
}
main()
  .then(() => process.exit(0))
  .finally(() => p.$disconnect())
