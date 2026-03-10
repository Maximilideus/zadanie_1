/**
 * One-time backfill: migrate legacy catalog package data into Package + PackageService.
 *
 * Source: CatalogItem (type = PACKAGE), CatalogItemPackage, CatalogItem.serviceId
 * Target: Package, PackageService
 *
 * After creating relations, recalculates and persists Package.price and Package.durationMin
 * from the sum of linked Service prices and durations.
 *
 * Run: npm run backfill-packages (or ts-node prisma/backfillPackagesFromCatalog.ts)
 * Safe to run; re-running may create duplicate Package rows (no deduplication by legacy id).
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
  let relationsCreated = 0;
  const skippedChildren: { catalogItemTitle: string; packageTitle: string; reason: string }[] = [];

  for (const catItem of legacyPackages) {
    const name = catItem.titleRu || "Unnamed package";
    const category = catItem.category;

    const pkg = await prisma.package.create({
      data: {
        locationId: catItem.locationId,
        name,
        category: category,
        description: catItem.descriptionRu ?? null,
        price: 0,
        durationMin: 0,
        isVisible: catItem.isVisible,
        isBookable: true,
        sortOrder: catItem.sortOrder,
      },
    });
    packagesCreated += 1;

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

      await prisma.packageService.upsert({
        where: {
          packageId_serviceId: { packageId: pkg.id, serviceId: child.serviceId },
        },
        create: {
          packageId: pkg.id,
          serviceId: child.serviceId,
          sortOrder: link.sortOrder,
        },
        update: { sortOrder: link.sortOrder },
      });
      relationsCreated += 1;
    }
  }

  // Recalculate and persist Package.price and Package.durationMin from linked services
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
  console.log(`  Legacy packages processed: ${legacyPackages.length}`);
  console.log(`  Package rows created:       ${packagesCreated}`);
  console.log(`  PackageService relations:  ${relationsCreated}`);
  console.log(`  Skipped children (no/invalid serviceId): ${skippedChildren.length}`);
  if (skippedChildren.length > 0) {
    console.log("  Skipped details:");
    skippedChildren.forEach((s) =>
      console.log(`    - "${s.catalogItemTitle}" in "${s.packageTitle}": ${s.reason}`)
    );
  }
  console.log("[backfill-packages] Package price and durationMin updated from sum of linked services.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[backfill-packages] Fatal error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
