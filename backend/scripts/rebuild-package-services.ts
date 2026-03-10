/**
 * Safe rebuild of PackageService from legacy package composition using the new Service foundation.
 *
 * Legacy source: CatalogItemPackage (packageId -> CatalogItem PACKAGE, itemId -> child CatalogItem).
 * Resolve Package: CatalogItem PACKAGE -> Package by locationId + name (titleRu).
 * Resolve Service: child CatalogItem id (itemId) -> Service where sourceCatalogItemId = itemId.
 *
 * Modes:
 *   dry-run  — show planned creates/updates, unresolved, duplicates; no writes
 *   apply    — create/update PackageService rows only (batched, log and continue on failure)
 *   verify   — check every resolvable component has PackageService, no duplicates, report unresolved
 *
 * Does NOT: rebuild Package rows, recalc price/duration, touch Subscription, remove CatalogItemPackage,
 *           switch runtime, or change booking.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BATCH_SIZE = 50;

type Mode = "dry-run" | "apply" | "verify";

interface RebuildStats {
  linksScanned: number;
  packageResolved: number;
  packageUnresolved: number;
  serviceResolved: number;
  serviceUnresolved: number;
  wouldCreate: number;
  wouldUpdate: number;
  created: number;
  updated: number;
  failed: number;
}

const unresolvedPackage: { packageCatalogId: string; packageTitle: string; reason: string }[] = [];
const unresolvedService: { packageTitle: string; childCatalogId: string; childTitle: string; reason: string }[] = [];
const duplicatePairs: { packageId: string; serviceId: string; count: number }[] = [];

async function loadLegacyComposition() {
  const packageCatalogItems = await prisma.catalogItem.findMany({
    where: { type: "PACKAGE" },
    include: {
      packageItemsAsPackage: {
        orderBy: { sortOrder: "asc" },
        include: {
          item: { select: { id: true, titleRu: true } },
        },
      },
    },
  });
  return packageCatalogItems;
}

async function resolvePackage(catalogPackage: { id: string; locationId: string; titleRu: string }) {
  const name = catalogPackage.titleRu?.trim() || "";
  if (!name) return null;
  const pkg = await prisma.package.findFirst({
    where: { locationId: catalogPackage.locationId, name },
    select: { id: true },
  });
  return pkg?.id ?? null;
}

async function resolveService(childCatalogItemId: string) {
  const svc = await prisma.service.findUnique({
    where: { sourceCatalogItemId: childCatalogItemId },
    select: { id: true },
  });
  return svc?.id ?? null;
}

async function runDryRun(stats: RebuildStats) {
  const packageCatalogItems = await loadLegacyComposition();
  const allLinks: { packageCatalogId: string; packageTitle: string; packageLocationId: string; itemId: string; childTitle: string; sortOrder: number }[] = [];
  for (const cat of packageCatalogItems) {
    const packageTitle = cat.titleRu?.trim() || "(no title)";
    for (const link of cat.packageItemsAsPackage) {
      allLinks.push({
        packageCatalogId: cat.id,
        packageTitle,
        packageLocationId: cat.locationId,
        itemId: link.item.id,
        childTitle: link.item.titleRu,
        sortOrder: link.sortOrder,
      });
    }
  }
  stats.linksScanned = allLinks.length;

  const packageIdByCatalogId = new Map<string, string | null>();
  for (const cat of packageCatalogItems) {
    const pid = await resolvePackage({ id: cat.id, locationId: cat.locationId, titleRu: cat.titleRu });
    packageIdByCatalogId.set(cat.id, pid);
    if (pid) {
      stats.packageResolved += 1;
    } else {
      stats.packageUnresolved += 1;
      unresolvedPackage.push({
        packageCatalogId: cat.id,
        packageTitle: cat.titleRu || "",
        reason: "no Package found for locationId + name",
      });
    }
  }

  for (const link of allLinks) {
    const packageId = packageIdByCatalogId.get(link.packageCatalogId);
    if (!packageId) continue;
    const serviceId = await resolveService(link.itemId);
    if (!serviceId) {
      stats.serviceUnresolved += 1;
      unresolvedService.push({
        packageTitle: link.packageTitle,
        childCatalogId: link.itemId,
        childTitle: link.childTitle,
        reason: "no Service with sourceCatalogItemId = child CatalogItem id",
      });
      continue;
    }
    stats.serviceResolved += 1;
    const existing = await prisma.packageService.findUnique({
      where: { packageId_serviceId: { packageId, serviceId } },
      select: { id: true },
    });
    if (existing) stats.wouldUpdate += 1;
    else stats.wouldCreate += 1;
  }

  const allPs = await prisma.packageService.findMany({ select: { packageId: true, serviceId: true } });
  const pairCount = new Map<string, { packageId: string; serviceId: string; count: number }>();
  for (const ps of allPs) {
    const key = `${ps.packageId}:${ps.serviceId}`;
    if (!pairCount.has(key)) pairCount.set(key, { packageId: ps.packageId, serviceId: ps.serviceId, count: 0 });
    pairCount.get(key)!.count += 1;
  }
  for (const v of pairCount.values()) {
    if (v.count > 1) duplicatePairs.push({ packageId: v.packageId, serviceId: v.serviceId, count: v.count });
  }

  console.log("[rebuild-package-services] dry-run:");
  console.log(`  Legacy package-component links scanned: ${stats.linksScanned}`);
  console.log(`  Package resolved / unresolved:          ${stats.packageResolved} / ${stats.packageUnresolved}`);
  console.log(`  Service resolved / unresolved:         ${stats.serviceResolved} / ${stats.serviceUnresolved}`);
  console.log(`  Would create PackageService:            ${stats.wouldCreate}`);
  console.log(`  Would update PackageService:            ${stats.wouldUpdate}`);
  if (unresolvedPackage.length) {
    console.log("  Unresolved packages:");
    unresolvedPackage.forEach((u) => console.log(`    - ${u.packageCatalogId} "${u.packageTitle}": ${u.reason}`));
  }
  if (unresolvedService.length) {
    console.log("  Unresolved services (child CatalogItem -> Service):");
    unresolvedService.forEach((u) => console.log(`    - "${u.packageTitle}" child ${u.childCatalogId} "${u.childTitle}": ${u.reason}`));
  }
  if (duplicatePairs.length) {
    console.log("  Duplicate (packageId, serviceId) pairs in PackageService:");
    duplicatePairs.forEach((d) => console.log(`    - packageId=${d.packageId} serviceId=${d.serviceId} count=${d.count}`));
  }
}

async function runApply(stats: RebuildStats) {
  const packageCatalogItems = await loadLegacyComposition();
  const packageIdByCatalogId = new Map<string, string | null>();
  for (const cat of packageCatalogItems) {
    const pid = await resolvePackage({ id: cat.id, locationId: cat.locationId, titleRu: cat.titleRu });
    packageIdByCatalogId.set(cat.id, pid);
    if (pid) stats.packageResolved += 1;
    else stats.packageUnresolved += 1;
  }

  const links: { packageId: string; itemId: string; sortOrder: number }[] = [];
  for (const cat of packageCatalogItems) {
    const packageId = packageIdByCatalogId.get(cat.id);
    if (!packageId) continue;
    for (const link of cat.packageItemsAsPackage) {
      links.push({ packageId, itemId: link.item.id, sortOrder: link.sortOrder });
    }
  }
  stats.linksScanned = links.length;

  for (let i = 0; i < links.length; i += BATCH_SIZE) {
    const batch = links.slice(i, i + BATCH_SIZE);
    for (const link of batch) {
      try {
        const serviceId = await resolveService(link.itemId);
        if (!serviceId) {
          stats.serviceUnresolved += 1;
          continue;
        }
        stats.serviceResolved += 1;
        const existing = await prisma.packageService.findUnique({
          where: { packageId_serviceId: { packageId: link.packageId, serviceId } },
          select: { id: true },
        });
        await prisma.packageService.upsert({
          where: { packageId_serviceId: { packageId: link.packageId, serviceId } },
          create: { packageId: link.packageId, serviceId, sortOrder: link.sortOrder },
          update: { sortOrder: link.sortOrder },
        });
        if (existing) stats.updated += 1;
        else stats.created += 1;
      } catch (e) {
        stats.failed += 1;
        console.error(`  [failed] packageId=${link.packageId} itemId=${link.itemId}:`, e);
      }
    }
  }

  console.log("[rebuild-package-services] apply done:");
  console.log(`  created=${stats.created} updated=${stats.updated} serviceUnresolved=${stats.serviceUnresolved} failed=${stats.failed}`);
}

async function runVerify() {
  let ok = true;
  const packageCatalogItems = await loadLegacyComposition();
  const packageIdByCatalogId = new Map<string, string>();
  for (const cat of packageCatalogItems) {
    const pid = await resolvePackage({ id: cat.id, locationId: cat.locationId, titleRu: cat.titleRu });
    if (pid) packageIdByCatalogId.set(cat.id, pid);
  }

  let missing = 0;
  for (const cat of packageCatalogItems) {
    const packageId = packageIdByCatalogId.get(cat.id);
    if (!packageId) continue;
    for (const link of cat.packageItemsAsPackage) {
      const serviceId = await resolveService(link.item.id);
      if (!serviceId) {
        console.error(`  [verify] Unresolved component: package "${cat.titleRu}" child "${link.item.titleRu}" (${link.item.id}) has no Service with sourceCatalogItemId`);
        missing += 1;
        ok = false;
        continue;
      }
      const row = await prisma.packageService.findUnique({
        where: { packageId_serviceId: { packageId, serviceId } },
        select: { id: true },
      });
      if (!row) {
        console.error(`  [verify] Missing PackageService: packageId=${packageId} serviceId=${serviceId} (child ${link.item.id})`);
        missing += 1;
        ok = false;
      }
    }
  }

  const allPs = await prisma.packageService.findMany({ select: { packageId: true, serviceId: true } });
  const pairCount = new Map<string, number>();
  for (const ps of allPs) {
    const key = `${ps.packageId}:${ps.serviceId}`;
    pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
  }
  for (const [key, count] of pairCount) {
    if (count > 1) {
      const [packageId, serviceId] = key.split(":");
      console.error(`  [verify] Duplicate PackageService: packageId=${packageId} serviceId=${serviceId} count=${count}`);
      ok = false;
    }
  }

  if (ok && missing === 0) {
    console.log("[rebuild-package-services] verify OK: every resolvable package component has a PackageService row, no duplicates. Package and CatalogItemPackage untouched.");
  } else {
    process.exitCode = 1;
  }
}

async function main() {
  const mode = (process.argv[2] || "dry-run").toLowerCase() as Mode;
  if (mode !== "dry-run" && mode !== "apply" && mode !== "verify") {
    console.error("Usage: ts-node scripts/rebuild-package-services.ts [dry-run|apply|verify]");
    process.exit(1);
  }

  const stats: RebuildStats = {
    linksScanned: 0,
    packageResolved: 0,
    packageUnresolved: 0,
    serviceResolved: 0,
    serviceUnresolved: 0,
    wouldCreate: 0,
    wouldUpdate: 0,
    created: 0,
    updated: 0,
    failed: 0,
  };

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
    console.error("[rebuild-package-services] Fatal:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
