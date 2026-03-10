/**
 * Create NEW normalized Package rows (with optional gender variants) from legacy composition.
 *
 * Legacy source: CatalogItem (type = PACKAGE), CatalogItemPackage, child CatalogItem.
 * Resolve Service: Service.sourceCatalogItemId = child CatalogItem id.
 *
 * Variant identity: (sourceLegacyPackageId, normalizedVariantKey) unique.
 * - ELECTRO (and MASSAGE): never split by gender; one normalized Package per legacy source (variantKey = null).
 * - LASER and WAX: may create multiple variants (female, male, unisex) only when underlying
 *   Service rows clearly support that variant; do not invent variants without matching services.
 *
 * Old Package rows (sourceLegacyPackageId = null) are never modified.
 *
 * Modes: dry-run | apply | verify
 */

import { PrismaClient } from "@prisma/client";
import type { CatalogCategory, CatalogGender } from "@prisma/client";

const prisma = new PrismaClient();
const BATCH_SIZE = 30;

type Mode = "dry-run" | "apply" | "verify";

const VARIANT_KEYS = ["female", "male", "unisex"] as const;
type VariantKey = (typeof VARIANT_KEYS)[number];

function genderToVariantKey(g: CatalogGender): VariantKey {
  return g.toLowerCase() as VariantKey;
}

interface ResolvedService {
  serviceId: string;
  sortOrder: number;
  price: number;
  durationMin: number;
  gender: CatalogGender | null;
}

interface VariantPlan {
  legacyCatalogId: string;
  normalizedVariantKey: VariantKey | null;
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
  normalizedVariantKey: VariantKey | null
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

async function loadLegacyPackages(): Promise<{ plans: VariantPlan[]; unresolved: number; skipReasons: string[] }> {
  const catalogPackages = await prisma.catalogItem.findMany({
    where: { type: "PACKAGE" },
    include: {
      packageItemsAsPackage: {
        orderBy: { sortOrder: "asc" },
        include: { item: { select: { id: true, titleRu: true } } },
      },
    },
  });

  const plans: VariantPlan[] = [];
  let unresolved = 0;
  const skipReasons: string[] = [];

  for (const cat of catalogPackages) {
    const services: ResolvedService[] = [];
    let skipReason: string | undefined;

    for (const link of cat.packageItemsAsPackage) {
      const svc = await prisma.service.findUnique({
        where: { sourceCatalogItemId: link.item.id },
        select: { id: true, price: true, durationMin: true, gender: true },
      });
      if (!svc) {
        skipReason = `child CatalogItem ${link.item.id} ("${link.item.titleRu}") has no Service with sourceCatalogItemId`;
        break;
      }
      services.push({
        serviceId: svc.id,
        sortOrder: link.sortOrder,
        price: svc.price,
        durationMin: svc.durationMin,
        gender: svc.gender,
      });
    }

    if (skipReason) {
      unresolved += 1;
      skipReasons.push(`${cat.id} "${cat.titleRu}": ${skipReason}`);
      continue;
    }

    const category = cat.category;
    const name = cat.titleRu?.trim() || "Unnamed";

    if (category === "ELECTRO" || category === "MASSAGE") {
      const price = services.reduce((s, x) => s + x.price, 0);
      const durationMin = services.reduce((s, x) => s + x.durationMin, 0);
      const singleGender = (() => {
        const set = new Set<CatalogGender | null>();
        services.forEach((s) => set.add(s.gender));
        return set.size === 1 ? [...set][0] ?? null : null;
      })();
      plans.push({
        legacyCatalogId: cat.id,
        normalizedVariantKey: null,
        name,
        locationId: cat.locationId,
        category,
        gender: singleGender,
        services,
        price,
        durationMin,
        isVisible: cat.isVisible,
        sortOrder: cat.sortOrder,
      });
      continue;
    }

    if (category === "LASER" || category === "WAX") {
      const byGender = new Map<CatalogGender, ResolvedService[]>();
      for (const s of services) {
        if (s.gender) {
          if (!byGender.has(s.gender)) byGender.set(s.gender, []);
          byGender.get(s.gender)!.push(s);
        }
      }
      const gendersPresent = [...byGender.keys()];
      if (gendersPresent.length === 0) {
        const price = services.reduce((s, x) => s + x.price, 0);
        const durationMin = services.reduce((s, x) => s + x.durationMin, 0);
        plans.push({
          legacyCatalogId: cat.id,
          normalizedVariantKey: "unisex",
          name,
          locationId: cat.locationId,
          category,
          gender: null,
          services,
          price,
          durationMin,
          isVisible: cat.isVisible,
          sortOrder: cat.sortOrder,
        });
      } else {
        for (const g of gendersPresent) {
          const variantServices = byGender.get(g)!;
          const price = variantServices.reduce((s, x) => s + x.price, 0);
          const durationMin = variantServices.reduce((s, x) => s + x.durationMin, 0);
          const key = genderToVariantKey(g);
          plans.push({
            legacyCatalogId: cat.id,
            normalizedVariantKey: key,
            name,
            locationId: cat.locationId,
            category,
            gender: g,
            services: variantServices,
            price,
            durationMin,
            isVisible: cat.isVisible,
            sortOrder: cat.sortOrder,
          });
        }
      }
      continue;
    }

    const price = services.reduce((s, x) => s + x.price, 0);
    const durationMin = services.reduce((s, x) => s + x.durationMin, 0);
    const singleGender = (() => {
      const set = new Set<CatalogGender | null>();
      services.forEach((s) => set.add(s.gender));
      return set.size === 1 ? [...set][0] ?? null : null;
    })();
    plans.push({
      legacyCatalogId: cat.id,
      normalizedVariantKey: null,
      name,
      locationId: cat.locationId,
      category,
      gender: singleGender,
      services,
      price,
      durationMin,
      isVisible: cat.isVisible,
      sortOrder: cat.sortOrder,
    });
  }

  return { plans, unresolved, skipReasons };
}

async function runDryRun() {
  const { plans, unresolved, skipReasons } = await loadLegacyPackages();
  let toCreate = 0;
  let toUpdate = 0;
  let psCreate = 0;
  let psUpdate = 0;

  for (const p of plans) {
    let existing = await findNormalizedPackage(p.legacyCatalogId, p.normalizedVariantKey);
    if (!existing && p.normalizedVariantKey !== null) {
      const legacySingle = await prisma.package.findFirst({
        where: { sourceLegacyPackageId: p.legacyCatalogId, normalizedVariantKey: null },
        select: { id: true },
      });
      if (legacySingle) existing = { id: legacySingle.id };
    }
    if (existing) {
      toUpdate += 1;
      psUpdate += p.services.length;
    } else {
      toCreate += 1;
      psCreate += p.services.length;
    }
  }

  console.log("[create-normalized-packages] dry-run:");
  console.log(`  Legacy packages scanned:           ${plans.length + unresolved}`);
  console.log(`  Normalized variant plans:         ${plans.length}`);
  console.log(`  New normalized packages to create:  ${toCreate}`);
  console.log(`  Existing normalized packages to update: ${toUpdate}`);
  console.log(`  Unresolved (skipped):              ${unresolved}`);
  console.log(`  PackageService rows to create:     ${psCreate}`);
  console.log(`  PackageService rows to update:     ${psUpdate}`);
  skipReasons.forEach((r) => console.log(`  [unresolved] ${r}`));
}

async function runApply() {
  const { plans, unresolved, skipReasons } = await loadLegacyPackages();
  let created = 0;
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < plans.length; i += BATCH_SIZE) {
    const batch = plans.slice(i, i + BATCH_SIZE);
    for (const p of batch) {
      try {
        let existing = await findNormalizedPackage(p.legacyCatalogId, p.normalizedVariantKey);
        if (!existing && p.normalizedVariantKey !== null) {
          const legacySingle = await prisma.package.findFirst({
            where: { sourceLegacyPackageId: p.legacyCatalogId, normalizedVariantKey: null },
            select: { id: true },
          });
          if (legacySingle) {
            await prisma.package.update({
              where: { id: legacySingle.id },
              data: { normalizedVariantKey: p.normalizedVariantKey },
            });
            existing = { id: legacySingle.id };
          }
        }

        const payload = {
          locationId: p.locationId,
          name: p.name,
          category: p.category,
          gender: p.gender,
          price: p.price,
          durationMin: p.durationMin,
          isVisible: p.isVisible,
          isBookable: true,
          sortOrder: p.sortOrder,
          sourceLegacyPackageId: p.legacyCatalogId,
          ...(p.normalizedVariantKey !== null && { normalizedVariantKey: p.normalizedVariantKey }),
        };

        let packageId: string;
        if (existing) {
          await prisma.package.update({
            where: { id: existing.id },
            data: {
              name: payload.name,
              category: payload.category,
              gender: payload.gender,
              price: payload.price,
              durationMin: payload.durationMin,
              isVisible: payload.isVisible,
              sortOrder: payload.sortOrder,
            },
          });
          packageId = existing.id;
          updated += 1;
        } else {
          const createdPkg = await prisma.package.create({ data: payload });
          packageId = createdPkg.id;
          created += 1;
        }

        const wantedServiceIds = p.services.map((s) => s.serviceId);
        if (existing) {
          await prisma.packageService.deleteMany({
            where: { packageId, serviceId: { notIn: wantedServiceIds } },
          });
        }
        for (const s of p.services) {
          await prisma.packageService.upsert({
            where: { packageId_serviceId: { packageId, serviceId: s.serviceId } },
            create: { packageId, serviceId: s.serviceId, sortOrder: s.sortOrder },
            update: { sortOrder: s.sortOrder },
          });
        }
      } catch (e) {
        failed += 1;
        console.error(`  [failed] ${p.legacyCatalogId} variant=${p.normalizedVariantKey} "${p.name}":`, e);
      }
    }
  }

  console.log("[create-normalized-packages] apply done:");
  console.log(`  created=${created} updated=${updated} unresolved=${unresolved} failed=${failed}`);
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
