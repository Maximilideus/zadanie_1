/**
 * Backfill Zone dictionary from existing Service.zoneKey values.
 * Idempotent: only creates zones that don't exist.
 * Run: npx ts-node scripts/backfill-zones.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.service.findMany({
    where: { zoneKey: { not: null } },
    select: { zoneKey: true, name: true },
    orderBy: { name: "asc" },
  });

  const labelMap = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const zk = r.zoneKey!;
    if (!labelMap.has(zk)) labelMap.set(zk, new Map());
    const counts = labelMap.get(zk)!;
    counts.set(r.name, (counts.get(r.name) ?? 0) + 1);
  }

  let created = 0;
  let skipped = 0;

  for (const [zoneKey, counts] of labelMap) {
    const existing = await prisma.zone.findUnique({
      where: { zoneKey },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    let bestLabel = "";
    let bestCount = 0;
    for (const [name, count] of counts) {
      if (count > bestCount) {
        bestLabel = name;
        bestCount = count;
      }
    }

    await prisma.zone.create({
      data: {
        zoneKey,
        labelRu: bestLabel || zoneKey,
        isActive: true,
        sortOrder: 0,
      },
    });
    created++;
    console.log(`Created zone: ${zoneKey} -> "${bestLabel}"`);
  }

  console.log(`Done. Created: ${created}, skipped (already exist): ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
