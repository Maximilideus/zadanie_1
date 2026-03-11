/**
 * One-time backfill: migrate legacy catalog package data into Package + PackageService.
 *
 * Source: CatalogItem (type = PACKAGE), CatalogItemPackage, CatalogItem.serviceId
 * Target: Package, PackageService
 *
 * After creating/updating relations, recalculates and persists:
 *   Package.price = sum(Service.price)
 *   Package.durationMin = sum(Service.durationMin)
 *
 * Idempotent: re-run safe. Uses locationId + name to find existing Package (no duplicate rows).
 * PackageService uses upsert on (packageId, serviceId).
 *
 * Run: npm run backfill-packages
 * Or:  ts-node prisma/backfillPackagesFromCatalog.ts
 *
 * Does NOT: delete or modify CatalogItem / CatalogItemPackage, change read paths, or touch booking/AvailabilityService.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const legacyPackages = await prisma.catalogItem.findMany({
    where: { type: "PACKAGE" },
    include: {
      packageItemsAsPackage: {
        orderBy: { sortOrder: "asc" },
        include: {
          item: {
            select: { id: true, titleRu: true, serviceId: true },
          },
        },
      },
    },
  });

  if (legacyPackages.length === 0) {
    console.log("[backfill-packages] No legacy catalog packages (CatalogItem type PACKAGE) found. Nothing to do.");
    return;
  }

  let packagesCreated = 0;
  let packagesUpdated = 0;
  let relationsCreated = 0;
  let relationsUpdated = 0;
  const skippedChildren: { catalogItemTitle: string; packageTitle: string; reason: string }[] = [];

  for (const catItem of legacyPackages) {
    const name = catItem.titleRu?.trim() || "Unnamed package";
    const locationId = catItem.locationId;
    const category = catItem.category;

    const payload = {
      locationId,
      name,
      category,
      gender: catItem.gender ?? null,
      description: catItem.descriptionRu?.trim() || null,
      isVisible: catItem.isVisible,
      isBookable: true,
      sortOrder: catItem.sortOrder,
      price: 0,
      durationMin: 0,
      packageKind: "MIGRATED" as const,
    };

    const existing = await prisma.package.findFirst({
      where: { locationId, name },
      select: { id: true },
    });

    let pkgId: string;
    if (existing) {
      await prisma.package.update({
        where: { id: existing.id },
        data: {
          category: payload.category,
          gender: payload.gender,
          description: payload.description,
          isVisible: payload.isVisible,
          sortOrder: payload.sortOrder,
        },
      });
      pkgId = existing.id;
      packagesUpdated += 1;
    } else {
      const pkg = await prisma.package.create({
        data: payload,
      });
      pkgId = pkg.id;
      packagesCreated += 1;
    }

    for (const link of catItem.packageItemsAsPackage) {
      const child = link.item;
      if (!child.serviceId) {
        skippedChildren.push({
          catalogItemTitle: child.titleRu,
          packageTitle: name,
          reason: "child CatalogItem has no serviceId",
        });
        continue;
      }

      const serviceExists = await prisma.service.findUnique({
        where: { id: child.serviceId },
        select: { id: true },
      });
      if (!serviceExists) {
        skippedChildren.push({
          catalogItemTitle: child.titleRu,
          packageTitle: name,
          reason: "serviceId does not exist in Service table",
        });
        continue;
      }

      const existed = await prisma.packageService.findUnique({
        where: {
          packageId_serviceId: { packageId: pkgId, serviceId: child.serviceId },
        },
        select: { id: true },
      });

      await prisma.packageService.upsert({
        where: {
          packageId_serviceId: { packageId: pkgId, serviceId: child.serviceId },
        },
        create: {
          packageId: pkgId,
          serviceId: child.serviceId,
          sortOrder: link.sortOrder,
        },
        update: { sortOrder: link.sortOrder },
      });

      if (existed) relationsUpdated += 1;
      else relationsCreated += 1;
    }
  }

  const allPackages = await prisma.package.findMany({
    include: {
      services: {
        orderBy: { sortOrder: "asc" },
        include: { service: { select: { price: true, durationMin: true } } },
      },
    },
  });

  for (const pkg of allPackages) {
    const price = pkg.services.reduce((sum, ps) => sum + ps.service.price, 0);
    const durationMin = pkg.services.reduce((sum, ps) => sum + ps.service.durationMin, 0);
    await prisma.package.update({
      where: { id: pkg.id },
      data: { price, durationMin },
    });
  }

  console.log("[backfill-packages] Summary:");
  console.log(`  Legacy package CatalogItems found: ${legacyPackages.length}`);
  console.log(`  Package rows created:              ${packagesCreated}`);
  console.log(`  Package rows updated (existing): ${packagesUpdated}`);
  console.log(`  PackageService rows created:      ${relationsCreated}`);
  console.log(`  PackageService rows updated:      ${relationsUpdated}`);
  console.log(`  Child items skipped:               ${skippedChildren.length}`);
  if (skippedChildren.length > 0) {
    console.log("  Skipped details:");
    skippedChildren.forEach((s) =>
      console.log(`    - "${s.catalogItemTitle}" in "${s.packageTitle}": ${s.reason}`)
    );
  }
  console.log("[backfill-packages] Package.price and Package.durationMin recalculated from sum of linked Service values.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[backfill-packages] Fatal error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
