/**
 * Repair normalized Package composition.
 *
 * Previous migration split services by their OWN gender, breaking mixed-gender
 * packages (e.g. "Бикини + Голени" ended up with only one service per variant).
 *
 * Correct rule: a package variant must contain ALL zones from the legacy package,
 * each resolved to the Service for that zone + target gender.
 * If any zone cannot be resolved for a target gender, that variant must not exist.
 *
 * Resolution strategy:
 *   For each child CatalogItem in a legacy package, resolve its Service and read
 *   Service.zoneKey. Then for each target gender, find a Service with the SAME
 *   zoneKey, same category, same locationId, and the target gender.
 *
 * Modes: dry-run | apply | verify
 *
 * Safety:
 *   - Does NOT modify CatalogItem, CatalogItemPackage, or Service rows.
 *   - Does NOT modify legacy Package rows (sourceLegacyPackageId = null).
 *   - Only operates on normalized Packages (sourceLegacyPackageId != null).
 */

import { PrismaClient } from "@prisma/client";
import type { CatalogCategory, CatalogGender } from "@prisma/client";

const prisma = new PrismaClient();

type Mode = "dry-run" | "apply" | "verify";

interface ResolvedService {
  serviceId: string;
  serviceName: string;
  price: number;
  durationMin: number;
  gender: CatalogGender;
}

interface VariantPlan {
  legacyCatalogId: string;
  legacyName: string;
  variantKey: "female" | "male" | null;
  variantGender: CatalogGender | null;
  category: CatalogCategory;
  locationId: string;
  services: ResolvedService[];
  price: number;
  durationMin: number;
  isVisible: boolean;
  sortOrder: number;
}

interface UnresolvedVariant {
  legacyCatalogId: string;
  legacyName: string;
  variantKey: string;
  missingZones: string[];
}

// ──────────────────────────── Zone Resolution ────────────────────────────

async function resolveZoneForGender(
  zoneKey: string,
  category: CatalogCategory,
  locationId: string,
  targetGender: CatalogGender
): Promise<ResolvedService | null> {
  const svc = await prisma.service.findFirst({
    where: { zoneKey, category, locationId, gender: targetGender },
    select: { id: true, name: true, price: true, durationMin: true, gender: true },
  });
  if (!svc || !svc.gender) return null;

  return {
    serviceId: svc.id,
    serviceName: svc.name,
    price: svc.price,
    durationMin: svc.durationMin,
    gender: svc.gender,
  };
}

// ──────────────────────────── Plan Builder ────────────────────────────

async function buildPlans(): Promise<{
  plans: VariantPlan[];
  unresolved: UnresolvedVariant[];
}> {
  const catalogPackages = await prisma.catalogItem.findMany({
    where: { type: "PACKAGE" },
    include: {
      packageItemsAsPackage: {
        orderBy: { sortOrder: "asc" },
        include: {
          item: {
            select: {
              id: true,
              titleRu: true,
              category: true,
              gender: true,
              locationId: true,
            },
          },
        },
      },
    },
  });

  const plans: VariantPlan[] = [];
  const unresolved: UnresolvedVariant[] = [];

  for (const cat of catalogPackages) {
    const children = cat.packageItemsAsPackage;
    if (children.length === 0) continue;

    const category = cat.category;
    const locationId = cat.locationId;
    const legacyName = cat.titleRu?.trim() || "Unnamed";

    // Resolve each child's zoneKey from its Service
    const childZoneKeys: { zoneKey: string; childName: string }[] = [];
    let zoneResolveFailed = false;
    for (const child of children) {
      const svc = await prisma.service.findUnique({
        where: { sourceCatalogItemId: child.item.id },
        select: { zoneKey: true, name: true },
      });
      if (!svc?.zoneKey) {
        unresolved.push({ legacyCatalogId: cat.id, legacyName, variantKey: "resolve", missingZones: [`${child.item.titleRu} (no Service or missing zoneKey)`] });
        zoneResolveFailed = true;
        break;
      }
      childZoneKeys.push({ zoneKey: svc.zoneKey, childName: svc.name });
    }
    if (zoneResolveFailed) continue;

    const targetGenders: { key: "female" | "male" | null; gender: CatalogGender | null }[] =
      category === "ELECTRO" || category === "MASSAGE"
        ? [{ key: null, gender: null }]
        : [
            { key: "female", gender: "FEMALE" as CatalogGender },
            { key: "male", gender: "MALE" as CatalogGender },
          ];

    for (const { key: variantKey, gender: targetGender } of targetGenders) {
      if (targetGender === null) {
        // ELECTRO/MASSAGE: resolve each child directly via sourceCatalogItemId
        const services: ResolvedService[] = [];
        const missing: string[] = [];
        for (const child of children) {
          const svc = await prisma.service.findUnique({
            where: { sourceCatalogItemId: child.item.id },
            select: { id: true, name: true, price: true, durationMin: true, gender: true },
          });
          if (svc) {
            services.push({
              serviceId: svc.id,
              serviceName: svc.name,
              price: svc.price,
              durationMin: svc.durationMin,
              gender: svc.gender!,
            });
          } else {
            missing.push(child.item.titleRu);
          }
        }
        if (missing.length > 0) {
          unresolved.push({ legacyCatalogId: cat.id, legacyName, variantKey: "null", missingZones: missing });
        } else {
          plans.push({
            legacyCatalogId: cat.id,
            legacyName,
            variantKey: null,
            variantGender: services.length === 1 ? services[0].gender : null,
            category,
            locationId,
            services,
            price: services.reduce((s, x) => s + x.price, 0),
            durationMin: services.reduce((s, x) => s + x.durationMin, 0),
            isVisible: cat.isVisible,
            sortOrder: cat.sortOrder,
          });
        }
        continue;
      }

      // LASER/WAX: resolve every zone for the target gender using zoneKey
      const services: ResolvedService[] = [];
      const missing: string[] = [];

      for (const { zoneKey, childName } of childZoneKeys) {
        const resolved = await resolveZoneForGender(zoneKey, category, locationId, targetGender);
        if (resolved) {
          services.push(resolved);
        } else {
          missing.push(`${childName} (zoneKey=${zoneKey})`);
        }
      }

      if (missing.length > 0) {
        unresolved.push({
          legacyCatalogId: cat.id,
          legacyName,
          variantKey: variantKey!,
          missingZones: missing,
        });
      } else {
        plans.push({
          legacyCatalogId: cat.id,
          legacyName,
          variantKey,
          variantGender: targetGender,
          category,
          locationId,
          services,
          price: services.reduce((s, x) => s + x.price, 0),
          durationMin: services.reduce((s, x) => s + x.durationMin, 0),
          isVisible: cat.isVisible,
          sortOrder: cat.sortOrder,
        });
      }
    }
  }

  return { plans, unresolved };
}

// ──────────────────────────── Dry Run ────────────────────────────

async function runDryRun() {
  const { plans, unresolved } = await buildPlans();

  const validKeys = new Set(plans.map((p) => `${p.legacyCatalogId}|${p.variantKey ?? ""}`));

  const existing = await prisma.package.findMany({
    where: { sourceLegacyPackageId: { not: null } },
    select: {
      id: true,
      name: true,
      sourceLegacyPackageId: true,
      normalizedVariantKey: true,
      services: { select: { serviceId: true } },
    },
  });

  let toCreate = 0;
  let toUpdate = 0;
  let toRemove = 0;
  let unchanged = 0;

  // Check which planned variants need creation vs update
  for (const plan of plans) {
    const match = existing.find(
      (e) =>
        e.sourceLegacyPackageId === plan.legacyCatalogId &&
        (e.normalizedVariantKey ?? "") === (plan.variantKey ?? "")
    );
    if (match) {
      const currentSvcIds = new Set(match.services.map((s) => s.serviceId));
      const plannedSvcIds = new Set(plan.services.map((s) => s.serviceId));
      const needsRepair =
        currentSvcIds.size !== plannedSvcIds.size ||
        [...plannedSvcIds].some((id) => !currentSvcIds.has(id)) ||
        match.name !== plan.legacyName;
      if (needsRepair) toUpdate++;
      else unchanged++;
    } else {
      toCreate++;
    }
  }

  // Check which existing variants are no longer valid
  for (const e of existing) {
    const key = `${e.sourceLegacyPackageId}|${e.normalizedVariantKey ?? ""}`;
    if (!validKeys.has(key)) toRemove++;
  }

  console.log("[repair-normalized-packages] dry-run:");
  console.log(`  Legacy packages scanned:    ${new Set(plans.map((p) => p.legacyCatalogId)).size + new Set(unresolved.map((u) => u.legacyCatalogId)).size}`);
  console.log(`  Valid variant plans:         ${plans.length}`);
  console.log(`  Existing normalized rows:    ${existing.length}`);
  console.log(`  To create (new variants):    ${toCreate}`);
  console.log(`  To repair (fix composition): ${toUpdate}`);
  console.log(`  To remove (invalid variant): ${toRemove}`);
  console.log(`  Unchanged:                   ${unchanged}`);
  console.log(`  Unresolved variants:         ${unresolved.length}`);

  if (plans.length > 0) {
    console.log("\n  --- Planned variants ---");
    for (const p of plans) {
      const svcList = p.services.map((s) => `${s.serviceName}(${s.gender})`).join(" + ");
      console.log(`  [${p.category}] "${p.legacyName}" variant=${p.variantKey ?? "single"} → ${svcList} = ${p.price}р ${p.durationMin}мин`);
    }
  }

  if (toRemove > 0) {
    console.log("\n  --- Variants to remove ---");
    for (const e of existing) {
      const key = `${e.sourceLegacyPackageId}|${e.normalizedVariantKey ?? ""}`;
      if (!validKeys.has(key)) {
        console.log(`  Package id=${e.id.slice(0, 8)}... "${e.name}" variant=${e.normalizedVariantKey ?? "null"} (source=${e.sourceLegacyPackageId?.slice(0, 8)}...)`);
      }
    }
  }

  if (unresolved.length > 0) {
    console.log("\n  --- Unresolved variants ---");
    for (const u of unresolved) {
      console.log(`  [${u.variantKey}] "${u.legacyName}" (source=${u.legacyCatalogId.slice(0, 8)}...) missing: ${u.missingZones.join(", ")}`);
    }
  }
}

// ──────────────────────────── Apply ────────────────────────────

async function runApply() {
  const { plans, unresolved } = await buildPlans();

  const validKeys = new Set(plans.map((p) => `${p.legacyCatalogId}|${p.variantKey ?? ""}`));

  const existing = await prisma.package.findMany({
    where: { sourceLegacyPackageId: { not: null } },
    select: {
      id: true,
      name: true,
      price: true,
      durationMin: true,
      sourceLegacyPackageId: true,
      normalizedVariantKey: true,
      services: { select: { serviceId: true } },
    },
  });

  let created = 0;
  let repaired = 0;
  let removed = 0;
  let unchanged = 0;
  let failed = 0;
  const examples: string[] = [];

  // 1. Create or repair planned variants
  for (const plan of plans) {
    const match = existing.find(
      (e) =>
        e.sourceLegacyPackageId === plan.legacyCatalogId &&
        (e.normalizedVariantKey ?? "") === (plan.variantKey ?? "")
    );

    const wantedSvcIds = plan.services.map((s) => s.serviceId);

    if (match) {
      const currentSvcIds = new Set(match.services.map((s) => s.serviceId));
      const plannedSvcIds = new Set(wantedSvcIds);
      const needsRepair =
        currentSvcIds.size !== plannedSvcIds.size ||
        [...plannedSvcIds].some((id) => !currentSvcIds.has(id)) ||
        match.name !== plan.legacyName ||
        match.price !== plan.price ||
        match.durationMin !== plan.durationMin;

      if (!needsRepair) {
        unchanged++;
        continue;
      }

      try {
        await prisma.$transaction(async (tx) => {
          await tx.package.update({
            where: { id: match.id },
            data: {
              name: plan.legacyName,
              category: plan.category,
              gender: plan.variantGender,
              price: plan.price,
              durationMin: plan.durationMin,
              isVisible: plan.isVisible,
              sortOrder: plan.sortOrder,
            },
          });

          await tx.packageService.deleteMany({
            where: { packageId: match.id },
          });

          for (let i = 0; i < plan.services.length; i++) {
            await tx.packageService.create({
              data: {
                packageId: match.id,
                serviceId: plan.services[i].serviceId,
                sortOrder: i,
              },
            });
          }
        });

        const svcBefore = match.services.map((s) => s.serviceId.slice(0, 8)).join(",");
        const svcAfter = wantedSvcIds.map((id) => id.slice(0, 8)).join(",");
        examples.push(
          `REPAIRED "${plan.legacyName}" variant=${plan.variantKey ?? "single"}: services [${svcBefore}] → [${svcAfter}], price ${match.price}→${plan.price}, dur ${match.durationMin}→${plan.durationMin}`
        );
        repaired++;
      } catch (e) {
        failed++;
        console.error(`  [failed] repair ${match.id}:`, e);
      }
    } else {
      // Create new variant
      try {
        const pkg = await prisma.package.create({
          data: {
            locationId: plan.locationId,
            name: plan.legacyName,
            category: plan.category,
            gender: plan.variantGender,
            price: plan.price,
            durationMin: plan.durationMin,
            isVisible: plan.isVisible,
            isBookable: true,
            sortOrder: plan.sortOrder,
            packageKind: "MIGRATED",
            sourceLegacyPackageId: plan.legacyCatalogId,
            normalizedVariantKey: plan.variantKey,
          },
        });

        for (let i = 0; i < plan.services.length; i++) {
          await prisma.packageService.create({
            data: {
              packageId: pkg.id,
              serviceId: plan.services[i].serviceId,
              sortOrder: i,
            },
          });
        }

        const svcList = plan.services.map((s) => `${s.serviceName}(${s.gender})`).join(" + ");
        examples.push(
          `CREATED "${plan.legacyName}" variant=${plan.variantKey ?? "single"}: ${svcList} = ${plan.price}р ${plan.durationMin}мин`
        );
        created++;
      } catch (e) {
        failed++;
        console.error(`  [failed] create ${plan.legacyCatalogId} variant=${plan.variantKey}:`, e);
      }
    }
  }

  // 2. Remove invalid variants (variants that should no longer exist)
  for (const e of existing) {
    const key = `${e.sourceLegacyPackageId}|${e.normalizedVariantKey ?? ""}`;
    if (!validKeys.has(key)) {
      // Safety check: don't delete if it has bookings
      const bookingCount = await prisma.booking.count({ where: { packageId: e.id } });
      if (bookingCount > 0) {
        console.log(`  [skip-delete] Package ${e.id.slice(0, 8)}... "${e.name}" variant=${e.normalizedVariantKey} has ${bookingCount} booking(s) — marking invisible instead`);
        await prisma.package.update({
          where: { id: e.id },
          data: { isVisible: false },
        });
        examples.push(`HIDDEN (has bookings) "${e.name}" variant=${e.normalizedVariantKey}`);
        removed++;
        continue;
      }

      try {
        await prisma.$transaction(async (tx) => {
          await tx.packageService.deleteMany({ where: { packageId: e.id } });
          await tx.masterPackage.deleteMany({ where: { packageId: e.id } });
          await tx.package.delete({ where: { id: e.id } });
        });
        examples.push(`REMOVED "${e.name}" variant=${e.normalizedVariantKey} (source=${e.sourceLegacyPackageId?.slice(0, 8)}...)`);
        removed++;
      } catch (e2) {
        failed++;
        console.error(`  [failed] remove ${e.id}:`, e2);
      }
    }
  }

  console.log("[repair-normalized-packages] apply done:");
  console.log(`  Created:    ${created}`);
  console.log(`  Repaired:   ${repaired}`);
  console.log(`  Removed:    ${removed}`);
  console.log(`  Unchanged:  ${unchanged}`);
  console.log(`  Failed:     ${failed}`);
  console.log(`  Unresolved: ${unresolved.length}`);

  if (examples.length > 0) {
    console.log("\n  --- Examples ---");
    examples.forEach((ex) => console.log(`  ${ex}`));
  }

  if (unresolved.length > 0) {
    console.log("\n  --- Unresolved variants (not created) ---");
    for (const u of unresolved) {
      console.log(`  [${u.variantKey}] "${u.legacyName}" missing: ${u.missingZones.join(", ")}`);
    }
  }
}

// ──────────────────────────── Verify ────────────────────────────

async function runVerify() {
  let ok = true;

  const normalized = await prisma.package.findMany({
    where: { sourceLegacyPackageId: { not: null } },
    include: {
      services: {
        orderBy: { sortOrder: "asc" },
        include: {
          service: {
            select: { id: true, name: true, price: true, durationMin: true, gender: true },
          },
        },
      },
    },
  });

  console.log("[repair-normalized-packages] verify:");
  console.log(`  Normalized packages found: ${normalized.length}`);

  for (const pkg of normalized) {
    // 1. Price = sum(service.price)
    const expectedPrice = pkg.services.reduce((s, ps) => s + ps.service.price, 0);
    if (pkg.price !== expectedPrice) {
      console.error(`  [FAIL] "${pkg.name}" id=${pkg.id.slice(0, 8)} variant=${pkg.normalizedVariantKey}: price ${pkg.price} != sum ${expectedPrice}`);
      ok = false;
    }

    // 2. DurationMin = sum(service.durationMin)
    const expectedDuration = pkg.services.reduce((s, ps) => s + ps.service.durationMin, 0);
    if (pkg.durationMin !== expectedDuration) {
      console.error(`  [FAIL] "${pkg.name}" id=${pkg.id.slice(0, 8)} variant=${pkg.normalizedVariantKey}: duration ${pkg.durationMin} != sum ${expectedDuration}`);
      ok = false;
    }

    // 3. All services match variant gender
    if (pkg.gender) {
      for (const ps of pkg.services) {
        if (ps.service.gender !== pkg.gender) {
          console.error(`  [FAIL] "${pkg.name}" id=${pkg.id.slice(0, 8)} variant=${pkg.normalizedVariantKey}: service "${ps.service.name}" gender=${ps.service.gender} != package gender=${pkg.gender}`);
          ok = false;
        }
      }
    }

    // 4. Verify against legacy composition (all zones present)
    if (pkg.sourceLegacyPackageId) {
      const legacy = await prisma.catalogItem.findUnique({
        where: { id: pkg.sourceLegacyPackageId },
        include: {
          packageItemsAsPackage: {
            orderBy: { sortOrder: "asc" },
            include: { item: { select: { titleRu: true } } },
          },
        },
      });

      if (legacy) {
        const expectedZoneCount = legacy.packageItemsAsPackage.length;
        if (pkg.services.length !== expectedZoneCount) {
          console.error(
            `  [FAIL] "${pkg.name}" id=${pkg.id.slice(0, 8)} variant=${pkg.normalizedVariantKey}: has ${pkg.services.length} services but legacy has ${expectedZoneCount} zones`
          );
          ok = false;
        }

        // Verify each zone name is represented
        const legacyZoneNames = legacy.packageItemsAsPackage.map((l) => l.item.titleRu);
        const pkgServiceNames = pkg.services.map((ps) => ps.service.name);
        for (const zone of legacyZoneNames) {
          if (!pkgServiceNames.includes(zone)) {
            console.error(
              `  [FAIL] "${pkg.name}" id=${pkg.id.slice(0, 8)} variant=${pkg.normalizedVariantKey}: missing zone "${zone}"`
            );
            ok = false;
          }
        }

        // Verify name matches
        if (pkg.name !== legacy.titleRu?.trim()) {
          console.warn(
            `  [WARN] "${pkg.name}" id=${pkg.id.slice(0, 8)} variant=${pkg.normalizedVariantKey}: name mismatch with legacy "${legacy.titleRu}"`
          );
        }
      }
    }

    // Log OK packages
    if (ok) {
      const svcList = pkg.services.map((ps) => `${ps.service.name}(${ps.service.gender})`).join(" + ");
      console.log(`  [OK] "${pkg.name}" variant=${pkg.normalizedVariantKey} gender=${pkg.gender}: ${svcList} = ${pkg.price}р ${pkg.durationMin}мин`);
    }
  }

  // 5. No duplicate (sourceLegacyPackageId, normalizedVariantKey)
  const seen = new Map<string, string[]>();
  for (const p of normalized) {
    const key = `${p.sourceLegacyPackageId}:${p.normalizedVariantKey ?? ""}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(p.id);
  }
  for (const [key, ids] of seen) {
    if (ids.length > 1) {
      console.error(`  [FAIL] Duplicate normalized Package for key=${key}: ${ids.join(", ")}`);
      ok = false;
    }
  }

  // 6. Legacy packages untouched
  const legacyCount = await prisma.package.count({ where: { sourceLegacyPackageId: null } });
  console.log(`  Legacy Package rows (untouched): ${legacyCount}`);

  if (ok) {
    console.log("\n  ✓ VERIFY PASSED: all normalized packages have correct composition, prices, durations, and gender consistency.");
  } else {
    console.error("\n  ✗ VERIFY FAILED: see errors above.");
    process.exitCode = 1;
  }
}

// ──────────────────────────── Main ────────────────────────────

async function main() {
  const mode = (process.argv[2] || "dry-run").toLowerCase() as Mode;
  if (mode !== "dry-run" && mode !== "apply" && mode !== "verify") {
    console.error("Usage: ts-node scripts/repair-normalized-packages.ts [dry-run|apply|verify]");
    process.exit(1);
  }

  if (mode === "dry-run") await runDryRun();
  else if (mode === "apply") await runApply();
  else await runVerify();
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error("[repair-normalized-packages] Fatal:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
