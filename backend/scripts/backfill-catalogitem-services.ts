/**
 * Safe migration: create real Service rows from eligible CatalogItem business data.
 *
 * This phase only prepares the Service foundation. It does NOT update CatalogItem.serviceId.
 *
 * Modes:
 *   dry-run  — print planned changes, no DB writes
 *   apply    — create/update Service rows only (no CatalogItem linkage in this phase)
 *   verify   — check Service integrity: source CatalogItem exists, no duplicates, required fields set, packages untouched
 *
 * Eligible = atomic service-like: type ZONE or OFFER, has locationId, non-empty titleRu,
 *            price and durationMin present and valid. Excludes PACKAGE and INFO.
 * Ambiguous = eligible but price 0 or durationMin 0; skipped and reported for manual review.
 *
 * Idempotent: uses Service.sourceCatalogItemId to avoid duplicate Service rows.
 *
 * Does NOT: update CatalogItem.serviceId, change booking, AvailabilityService, or switch read/write paths.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BATCH_SIZE = 50;

type Mode = "dry-run" | "apply" | "verify";

interface Stats {
  scanned: number;
  eligible: number;
  created: number;
  updated: number;
  skipped: number;
  ambiguous: number;
  failed: number;
}

function isEligible(item: {
  type: string;
  locationId: string;
  titleRu: string;
  price: number | null;
  durationMin: number | null;
}): { ok: true } | { ok: false; reason: string } {
  if (item.type === "PACKAGE") return { ok: false, reason: "type is PACKAGE" };
  if (item.type === "INFO") return { ok: false, reason: "type is INFO (presentation-only)" };
  if (!item.locationId?.trim()) return { ok: false, reason: "missing locationId" };
  const name = item.titleRu?.trim();
  if (!name) return { ok: false, reason: "missing or empty titleRu" };
  if (item.price == null) return { ok: false, reason: "missing price" };
  if (typeof item.price !== "number" || item.price < 0) return { ok: false, reason: "invalid price" };
  if (item.durationMin == null) return { ok: false, reason: "missing durationMin" };
  if (typeof item.durationMin !== "number" || item.durationMin < 1) return { ok: false, reason: "invalid durationMin" };
  return { ok: true };
}

function isAmbiguous(item: { titleRu: string; price: number; durationMin: number }): string | null {
  if (item.price === 0) return "price is 0";
  if (item.durationMin === 0) return "durationMin is 0";
  return null;
}

async function runDryRun(stats: Stats) {
  const items = await prisma.catalogItem.findMany({
    select: {
      id: true,
      locationId: true,
      category: true,
      type: true,
      gender: true,
      groupKey: true,
      titleRu: true,
      descriptionRu: true,
      price: true,
      durationMin: true,
      isVisible: true,
      sortOrder: true,
      serviceId: true,
    },
  });
  stats.scanned = items.length;

  for (const item of items) {
    const eligible = isEligible(item);
    if (!eligible.ok) {
      stats.skipped += 1;
      continue;
    }
    stats.eligible += 1;
    const amb = isAmbiguous({
      titleRu: item.titleRu,
      price: item.price!,
      durationMin: item.durationMin!,
    });
    if (amb) {
      stats.ambiguous += 1;
      console.log(`  [ambiguous] id=${item.id} titleRu="${item.titleRu}" — ${amb} (skipped for manual review)`);
      continue;
    }
    const existing = await prisma.service.findUnique({
      where: { sourceCatalogItemId: item.id },
      select: { id: true },
    });
    if (existing) stats.updated += 1;
    else stats.created += 1;
  }

  console.log("[backfill-catalogitem-services] dry-run plan:");
  console.log(`  Would create ${stats.created} Service(s), update ${stats.updated}, skip ${stats.skipped} CatalogItem(s), ${stats.ambiguous} ambiguous (skipped for manual review).`);
}

async function runApply(stats: Stats) {
  const items = await prisma.catalogItem.findMany({
    select: {
      id: true,
      locationId: true,
      category: true,
      type: true,
      gender: true,
      groupKey: true,
      titleRu: true,
      descriptionRu: true,
      price: true,
      durationMin: true,
      isVisible: true,
      sortOrder: true,
    },
  });
  stats.scanned = items.length;

  const eligibleList: typeof items = [];
  for (const item of items) {
    const result = isEligible(item);
    if (!result.ok) {
      stats.skipped += 1;
      continue;
    }
    stats.eligible += 1;
    const amb = isAmbiguous({
      titleRu: item.titleRu,
      price: item.price!,
      durationMin: item.durationMin!,
    });
    if (amb) {
      stats.ambiguous += 1;
      console.log(`  [ambiguous] id=${item.id} titleRu="${item.titleRu}" — ${amb} (skipped for manual review)`);
      continue;
    }
    eligibleList.push(item);
  }

  for (let i = 0; i < eligibleList.length; i += BATCH_SIZE) {
    const batch = eligibleList.slice(i, i + BATCH_SIZE);
    for (const item of batch) {
      try {
        const name = item.titleRu!.trim();
        const price = item.price!;
        const durationMin = item.durationMin!;
        const data = {
          locationId: item.locationId,
          name,
          category: item.category,
          gender: item.gender ?? undefined,
          groupKey: item.groupKey ?? undefined,
          description: item.descriptionRu?.trim() || null,
          price,
          durationMin,
          isVisible: item.isVisible,
          isBookable: true,
          sortOrder: item.sortOrder,
          sourceCatalogItemId: item.id,
        };

        const existing = await prisma.service.findUnique({
          where: { sourceCatalogItemId: item.id },
          select: { id: true },
        });

        if (existing) {
          await prisma.service.update({
            where: { id: existing.id },
            data: {
              name: data.name,
              category: data.category,
              gender: data.gender,
              groupKey: data.groupKey,
              description: data.description,
              price: data.price,
              durationMin: data.durationMin,
              isVisible: data.isVisible,
              sortOrder: data.sortOrder,
            },
          });
          stats.updated += 1;
        } else {
          await prisma.service.create({ data });
          stats.created += 1;
        }
      } catch (e) {
        stats.failed += 1;
        console.error(`  [failed] CatalogItem id=${item.id} titleRu="${item.titleRu}":`, e);
      }
    }
  }

  console.log("[backfill-catalogitem-services] apply done:");
  console.log(`  created=${stats.created} updated=${stats.updated} skipped=${stats.skipped} ambiguous=${stats.ambiguous} failed=${stats.failed}`);
}

async function runVerify() {
  let ok = true;

  const withSource = await prisma.service.findMany({
    where: { sourceCatalogItemId: { not: null } },
    select: { id: true, sourceCatalogItemId: true, name: true, price: true, durationMin: true },
  });
  const sourceIds = new Set(withSource.map((s) => s.sourceCatalogItemId!));

  for (const s of withSource) {
    const catId = s.sourceCatalogItemId!;
    const catalogItem = await prisma.catalogItem.findUnique({
      where: { id: catId },
      select: { id: true, type: true, titleRu: true },
    });
    if (!catalogItem) {
      console.error(`  [verify] Service ${s.id} sourceCatalogItemId=${catId} but CatalogItem not found`);
      ok = false;
    }
    if (s.price == null || s.durationMin == null) {
      console.error(`  [verify] Service ${s.id} missing price or durationMin`);
      ok = false;
    }
  }

  const bySource = new Map<string, string[]>();
  for (const s of withSource) {
    const id = s.sourceCatalogItemId!;
    if (!bySource.has(id)) bySource.set(id, []);
    bySource.get(id)!.push(s.id);
  }
  for (const [catId, serviceIds] of bySource) {
    if (serviceIds.length > 1) {
      console.error("  [verify] Duplicate Service rows for sourceCatalogItemId:", catId, "Service ids:", serviceIds);
      ok = false;
    }
  }

  const packages = await prisma.catalogItem.findMany({
    where: { type: "PACKAGE" },
    select: { id: true, titleRu: true },
  });
  for (const p of packages) {
    if (sourceIds.has(p.id)) {
      console.error(`  [verify] PACKAGE CatalogItem ${p.id} (${p.titleRu}) has a Service (packages must remain untouched)`);
      ok = false;
    }
  }

  if (ok) console.log("[backfill-catalogitem-services] verify OK: every Service with sourceCatalogItemId points to existing CatalogItem, no duplicates, required fields set, packages untouched.");
  else process.exitCode = 1;
}

async function main() {
  const mode = (process.argv[2] || "dry-run").toLowerCase() as Mode;
  if (mode !== "dry-run" && mode !== "apply" && mode !== "verify") {
    console.error("Usage: ts-node scripts/backfill-catalogitem-services.ts [dry-run|apply|verify]");
    process.exit(1);
  }

  const stats: Stats = { scanned: 0, eligible: 0, created: 0, updated: 0, skipped: 0, ambiguous: 0, failed: 0 };

  if (mode === "verify") {
    await runVerify();
    return;
  }
  if (mode === "dry-run") {
    await runDryRun(stats);
    return;
  }
  await runApply(stats);
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error("[backfill-catalogitem-services] Fatal:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
