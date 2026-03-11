/**
 * Create / update normalized Package rows from legacy composition.
 *
 * Legacy source: CatalogItem (type = PACKAGE), CatalogItemPackage, child CatalogItem.
 *
 * Zone resolution strategy (LASER / WAX):
 *   For each child CatalogItem in the legacy package, resolve its Service and read
 *   Service.zoneKey. Then for each target gender, find a Service with the SAME zoneKey,
 *   same category, same locationId, and the target gender.
 *   A variant is only created if ALL zones can be resolved for that gender.
 *
 * ELECTRO / MASSAGE: single variant (no gender split), resolved directly.
 *
 * Variant identity: (sourceLegacyPackageId, normalizedVariantKey) unique.
 * Old Package rows (sourceLegacyPackageId = null) are never modified.
 *
 * Modes: dry-run | apply | verify
 */

import { PrismaClient } from "@prisma/client";
import type { CatalogCategory, CatalogGender } from "@prisma/client";

const prisma = new PrismaClient();
const BATCH_SIZE = 30;

type Mode = "dry-run" | "apply" | "verify";

type VariantKey = "female" | "male" | null;

interface ResolvedService {
  serviceId: string;
  sortOrder: number;
  price: number;
  durationMin: number;
  gender: CatalogGender | null;
}

interface VariantPlan {
  legacyCatalogId: string;
  normalizedVariantKey: VariantKey;
  name: string;
  locationId: string;
  category: CatalogCategory;
  gender: CatalogGender | null;
  services: ResolvedService[];
  price: number;
  durationMin: number;
  isVisible: boolean;
  sortOrder: number;
}

async function findNormalizedPackage(
  sourceLegacyPackageId: string,
  normalizedVariantKey: VariantKey
): Promise<{ id: string } | null> {
  if (normalizedVariantKey === null) {
    return prisma.package.findFirst({
      where: { sourceLegacyPackageId, normalizedVariantKey: null },
      select: { id: true },
    });
  }
  return prisma.package.findUnique({
    where: {
      sourceLegacyPackageId_normalizedVariantKey: {
        sourceLegacyPackageId,
        normalizedVariantKey,
      },
    },
    select: { id: true },
  });
}

async function resolveZoneForGender(
  zoneKey: string,
  category: CatalogCategory,
  locationId: string,
  targetGender: CatalogGender
): Promise<ResolvedService | null> {
  const svc = await prisma.service.findFirst({
    where: { zoneKey, category, locationId, gender: targetGender },
    select: { id: true, price: true, durationMin: true, gender: true },
  });
  if (!svc || !svc.gender) return null;
  return { serviceId: svc.id, sortOrder: 0, price: svc.price, durationMin: svc.durationMin, gender: svc.gender };
}

async function loadLegacyPackages(): Promise<{ plans: VariantPlan[]; unresolved: number; skipReasons: string[] }> {
  const catalogPackages = await prisma.catalogItem.findMany({
    where: { type: "PACKAGE" },
    include: {
      packageItemsAsPackage: {
        orderBy: { sortOrder: "asc" },
        include: {
          item: {
            select: { id: true, titleRu: true, category: true, gender: true, locationId: true },
          },
        },
      },
    },
  });

  const plans: VariantPlan[] = [];
  let unresolved = 0;
  const skipReasons: string[] = [];

  for (const cat of catalogPackages) {
    const children = cat.packageItemsAsPackage;
    if (children.length === 0) continue;

    const category = cat.category;
    const locationId = cat.locationId;
    const name = cat.titleRu?.trim() || "Unnamed";

    if (category === "ELECTRO" || category === "MASSAGE") {
      const services: ResolvedService[] = [];
      let skipReason: string | undefined;
      for (const link of children) {
        const svc = await prisma.service.findUnique({
          where: { sourceCatalogItemId: link.item.id },
          select: { id: true, price: true, durationMin: true, gender: true },
        });
        if (!svc) {
          skipReason = `child "${link.item.titleRu}" has no Service`;
          break;
        }
        services.push({ serviceId: svc.id, sortOrder: link.sortOrder, price: svc.price, durationMin: svc.durationMin, gender: svc.gender });
      }
      if (skipReason) {
        unresolved++;
        skipReasons.push(`${cat.id} "${name}": ${skipReason}`);
        continue;
      }
      plans.push({
        legacyCatalogId: cat.id,
        normalizedVariantKey: null,
        name,
        locationId,
        category,
        gender: services.length === 1 ? services[0].gender : null,
        services,
        price: services.reduce((s, x) => s + x.price, 0),
        durationMin: services.reduce((s, x) => s + x.durationMin, 0),
        isVisible: cat.isVisible,
        sortOrder: cat.sortOrder,
      });
      continue;
    }

    // LASER / WAX: resolve each child's zoneKey, then find Services for each target gender
    const childZoneKeys: { zoneKey: string; childName: string }[] = [];
    let zoneResolveFailed = false;
    for (const child of children) {
      const svc = await prisma.service.findUnique({
        where: { sourceCatalogItemId: child.item.id },
        select: { zoneKey: true },
      });
      if (!svc?.zoneKey) {
        unresolved++;
        skipReasons.push(`${cat.id} "${name}": child "${child.item.titleRu}" has no Service or missing zoneKey`);
        zoneResolveFailed = true;
        break;
      }
      childZoneKeys.push({ zoneKey: svc.zoneKey, childName: child.item.titleRu });
    }
    if (zoneResolveFailed) continue;

    const targetGenders: { key: VariantKey; gender: CatalogGender }[] = [
      { key: "female", gender: "FEMALE" as CatalogGender },
      { key: "male", gender: "MALE" as CatalogGender },
    ];

    for (const { key: variantKey, gender: targetGender } of targetGenders) {
      const services: ResolvedService[] = [];
      const missing: string[] = [];

      for (let idx = 0; idx < childZoneKeys.length; idx++) {
        const { zoneKey, childName } = childZoneKeys[idx];
        const resolved = await resolveZoneForGender(zoneKey, category, locationId, targetGender);
        if (resolved) {
          resolved.sortOrder = idx;
          services.push(resolved);
        } else {
          missing.push(`${childName} (zoneKey=${zoneKey})`);
        }
      }

      if (missing.length > 0) {
        unresolved++;
        skipReasons.push(`${cat.id} "${name}" variant=${variantKey}: missing zones for ${targetGender}: ${missing.join(", ")}`);
      } else {
        plans.push({
          legacyCatalogId: cat.id,
          normalizedVariantKey: variantKey,
          name,
          locationId,
          category,
          gender: targetGender,
          services,
          price: services.reduce((s, x) => s + x.price, 0),
          durationMin: services.reduce((s, x) => s + x.durationMin, 0),
          isVisible: cat.isVisible,
          sortOrder: cat.sortOrder,
        });
      }
    }
  }

  return { plans, unresolved, skipReasons };
}

async function runDryRun() {
  const { plans, unresolved, skipReasons } = await loadLegacyPackages();
  const validKeys = new Set(plans.map((p) => `${p.legacyCatalogId}|${p.normalizedVariantKey ?? ""}`));

  const existing = await prisma.package.findMany({
    where: { sourceLegacyPackageId: { not: null } },
    select: { id: true, name: true, sourceLegacyPackageId: true, normalizedVariantKey: true, services: { select: { serviceId: true } } },
  });

  let toCreate = 0;
  let toUpdate = 0;
  let toRemove = 0;
  let unchanged = 0;

  for (const p of plans) {
    const match = existing.find((e) => e.sourceLegacyPackageId === p.legacyCatalogId && (e.normalizedVariantKey ?? "") === (p.normalizedVariantKey ?? ""));
    if (match) {
      const cur = new Set(match.services.map((s) => s.serviceId));
      const want = new Set(p.services.map((s) => s.serviceId));
      if (cur.size !== want.size || [...want].some((id) => !cur.has(id)) || match.name !== p.name) toUpdate++;
      else unchanged++;
    } else {
      toCreate++;
    }
  }

  for (const e of existing) {
    const key = `${e.sourceLegacyPackageId}|${e.normalizedVariantKey ?? ""}`;
    if (!validKeys.has(key)) toRemove++;
  }

  console.log("[create-normalized-packages] dry-run:");
  console.log(`  Valid variant plans:         ${plans.length}`);
  console.log(`  To create:                   ${toCreate}`);
  console.log(`  To update:                   ${toUpdate}`);
  console.log(`  To remove (invalid):         ${toRemove}`);
  console.log(`  Unchanged:                   ${unchanged}`);
  console.log(`  Unresolved:                  ${unresolved}`);
  skipReasons.forEach((r) => console.log(`  [unresolved] ${r}`));
}

async function runApply() {
  const { plans, unresolved, skipReasons } = await loadLegacyPackages();
  const validKeys = new Set(plans.map((p) => `${p.legacyCatalogId}|${p.normalizedVariantKey ?? ""}`));

  const existing = await prisma.package.findMany({
    where: { sourceLegacyPackageId: { not: null } },
    select: { id: true, name: true, price: true, durationMin: true, sourceLegacyPackageId: true, normalizedVariantKey: true, services: { select: { serviceId: true } } },
  });

  let created = 0;
  let updated = 0;
  let removed = 0;
  let failed = 0;

  for (const p of plans) {
    const match = existing.find((e) => e.sourceLegacyPackageId === p.legacyCatalogId && (e.normalizedVariantKey ?? "") === (p.normalizedVariantKey ?? ""));
    try {
      if (match) {
        await prisma.$transaction(async (tx) => {
          await tx.package.update({
            where: { id: match.id },
            data: { name: p.name, category: p.category, gender: p.gender, price: p.price, durationMin: p.durationMin, isVisible: p.isVisible, sortOrder: p.sortOrder },
          });
          await tx.packageService.deleteMany({ where: { packageId: match.id } });
          for (const s of p.services) {
            await tx.packageService.create({ data: { packageId: match.id, serviceId: s.serviceId, sortOrder: s.sortOrder } });
          }
        });
        updated++;
      } else {
        const pkg = await prisma.package.create({
          data: {
            locationId: p.locationId, name: p.name, category: p.category, gender: p.gender,
            price: p.price, durationMin: p.durationMin, isVisible: p.isVisible, isBookable: true,
            sortOrder: p.sortOrder, packageKind: "MIGRATED", sourceLegacyPackageId: p.legacyCatalogId, normalizedVariantKey: p.normalizedVariantKey,
          },
        });
        for (const s of p.services) {
          await prisma.packageService.create({ data: { packageId: pkg.id, serviceId: s.serviceId, sortOrder: s.sortOrder } });
        }
        created++;
      }
    } catch (e) {
      failed++;
      console.error(`  [failed] ${p.legacyCatalogId} variant=${p.normalizedVariantKey}:`, e);
    }
  }

  // Remove invalid variants
  for (const e of existing) {
    const key = `${e.sourceLegacyPackageId}|${e.normalizedVariantKey ?? ""}`;
    if (!validKeys.has(key)) {
      const bookings = await prisma.booking.count({ where: { packageId: e.id } });
      if (bookings > 0) {
        await prisma.package.update({ where: { id: e.id }, data: { isVisible: false } });
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.packageService.deleteMany({ where: { packageId: e.id } });
          await tx.masterPackage.deleteMany({ where: { packageId: e.id } });
          await tx.package.delete({ where: { id: e.id } });
        });
      }
      removed++;
    }
  }

  console.log("[create-normalized-packages] apply done:");
  console.log(`  created=${created} updated=${updated} removed=${removed} unresolved=${unresolved} failed=${failed}`);
  skipReasons.forEach((r) => console.log(`  [skip] ${r}`));
}

async function runVerify() {
  let ok = true;
  const normalized = await prisma.package.findMany({
    where: { sourceLegacyPackageId: { not: null } },
    include: {
      services: {
        orderBy: { sortOrder: "asc" },
        include: { service: { select: { price: true, durationMin: true } } },
      },
    },
  });

  for (const pkg of normalized) {
    const expectedPrice = pkg.services.reduce((s, ps) => s + ps.service.price, 0);
    const expectedDuration = pkg.services.reduce((s, ps) => s + ps.service.durationMin, 0);
    if (pkg.price !== expectedPrice) {
      console.error(
        `  [verify] Package ${pkg.id} (source=${pkg.sourceLegacyPackageId} variant=${pkg.normalizedVariantKey}) price ${pkg.price} != sum ${expectedPrice}`
      );
      ok = false;
    }
    if (pkg.durationMin !== expectedDuration) {
      console.error(
        `  [verify] Package ${pkg.id} (source=${pkg.sourceLegacyPackageId} variant=${pkg.normalizedVariantKey}) durationMin ${pkg.durationMin} != sum ${expectedDuration}`
      );
      ok = false;
    }
  }

  const seen = new Map<string, string[]>();
  for (const p of normalized) {
    const key = `${p.sourceLegacyPackageId}:${p.normalizedVariantKey ?? ""}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(p.id);
  }
  for (const [key, ids] of seen) {
    if (ids.length > 1) {
      console.error(`  [verify] Duplicate normalized Package for (sourceLegacyPackageId, variantKey)=${key}: ${ids.join(", ")}`);
      ok = false;
    }
  }

  if (ok) {
    console.log(
      "[create-normalized-packages] verify OK: normalized Packages have correct price/duration, no duplicate (source,variant). Old packages untouched."
    );
  } else {
    process.exitCode = 1;
  }
}

async function main() {
  const mode = (process.argv[2] || "dry-run").toLowerCase() as Mode;
  if (mode !== "dry-run" && mode !== "apply" && mode !== "verify") {
    console.error("Usage: ts-node scripts/create-normalized-packages.ts [dry-run|apply|verify]");
    process.exit(1);
  }

  if (mode === "verify") {
    await runVerify();
    return;
  }
  if (mode === "dry-run") {
    await runDryRun();
    return;
  }
  await runApply();
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error("[create-normalized-packages] Fatal:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
