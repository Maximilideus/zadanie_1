/**
 * Backfill Service.showOnWebsite / showInBot and Package.showOnWebsite / showInBot.
 *
 * Rules:
 *   Service  BUSINESS         → showOnWebsite=true,  showInBot=true
 *   Service  LEGACY_TEMPLATE  → showOnWebsite=false, showInBot=true
 *   Package  normalized       → showOnWebsite=true,  showInBot=false
 *   Package  legacy           → showOnWebsite=false, showInBot=false
 *
 * Modes: dry-run | apply | verify
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

type Mode = "dry-run" | "apply" | "verify"

async function runDryRun() {
  const services = await prisma.service.findMany({
    select: { id: true, name: true, serviceKind: true, showOnWebsite: true, showInBot: true },
  })

  let svcToUpdate = 0
  for (const svc of services) {
    const wantWeb = svc.serviceKind === "BUSINESS"
    const wantBot = true
    if (svc.showOnWebsite !== wantWeb || svc.showInBot !== wantBot) {
      svcToUpdate++
      console.log(`  [svc] "${svc.name}" ${svc.serviceKind}: web ${svc.showOnWebsite}→${wantWeb}, bot ${svc.showInBot}→${wantBot}`)
    }
  }

  const packages = await prisma.package.findMany({
    select: { id: true, name: true, sourceLegacyPackageId: true, showOnWebsite: true, showInBot: true },
  })

  let pkgToUpdate = 0
  for (const pkg of packages) {
    const isNormalized = pkg.sourceLegacyPackageId !== null
    const wantWeb = isNormalized
    const wantBot = false
    if (pkg.showOnWebsite !== wantWeb || pkg.showInBot !== wantBot) {
      pkgToUpdate++
      console.log(`  [pkg] "${pkg.name}" ${isNormalized ? "normalized" : "legacy"}: web ${pkg.showOnWebsite}→${wantWeb}, bot ${pkg.showInBot}→${wantBot}`)
    }
  }

  console.log(`\n[backfill-channel-visibility] dry-run:`)
  console.log(`  Services total: ${services.length}, to update: ${svcToUpdate}`)
  console.log(`  Packages total: ${packages.length}, to update: ${pkgToUpdate}`)
}

async function runApply() {
  const svcLegacy = await prisma.service.updateMany({
    where: { serviceKind: "LEGACY_TEMPLATE" },
    data: { showOnWebsite: false, showInBot: true },
  })
  const svcBusiness = await prisma.service.updateMany({
    where: { serviceKind: "BUSINESS" },
    data: { showOnWebsite: true, showInBot: true },
  })

  const pkgNormalized = await prisma.package.updateMany({
    where: { sourceLegacyPackageId: { not: null } },
    data: { showOnWebsite: true, showInBot: false },
  })
  const pkgLegacy = await prisma.package.updateMany({
    where: { sourceLegacyPackageId: null },
    data: { showOnWebsite: false, showInBot: false },
  })

  console.log(`[backfill-channel-visibility] apply done:`)
  console.log(`  Services BUSINESS updated:         ${svcBusiness.count}`)
  console.log(`  Services LEGACY_TEMPLATE updated:   ${svcLegacy.count}`)
  console.log(`  Packages normalized updated:        ${pkgNormalized.count}`)
  console.log(`  Packages legacy updated:            ${pkgLegacy.count}`)
}

async function runVerify() {
  let ok = true

  const svcBadWeb = await prisma.service.count({
    where: { serviceKind: "LEGACY_TEMPLATE", showOnWebsite: true },
  })
  if (svcBadWeb > 0) {
    console.error(`  [FAIL] ${svcBadWeb} LEGACY_TEMPLATE services have showOnWebsite=true`)
    ok = false
  }

  const svcBadBot = await prisma.service.count({
    where: { showInBot: false },
  })
  if (svcBadBot > 0) {
    console.error(`  [WARN] ${svcBadBot} services have showInBot=false (expected: all true after backfill)`)
  }

  const pkgLegacyOnWeb = await prisma.package.count({
    where: { sourceLegacyPackageId: null, showOnWebsite: true },
  })
  if (pkgLegacyOnWeb > 0) {
    console.error(`  [FAIL] ${pkgLegacyOnWeb} legacy packages have showOnWebsite=true`)
    ok = false
  }

  const normalizedNoWeb = await prisma.package.count({
    where: { sourceLegacyPackageId: { not: null }, showOnWebsite: false },
  })

  const svcStats = await prisma.service.groupBy({
    by: ["serviceKind"],
    _count: true,
  })
  const pkgTotal = await prisma.package.count()
  const pkgNorm = await prisma.package.count({ where: { sourceLegacyPackageId: { not: null } } })

  console.log(`[backfill-channel-visibility] verify:`)
  for (const g of svcStats) console.log(`  Service ${g.serviceKind}: ${g._count}`)
  console.log(`  Package total: ${pkgTotal}, normalized: ${pkgNorm}, legacy: ${pkgTotal - pkgNorm}`)
  console.log(`  Normalized packages hidden from web: ${normalizedNoWeb}`)
  console.log(ok ? "\n  ✓ VERIFY PASSED" : "\n  ✗ VERIFY FAILED")
  if (!ok) process.exitCode = 1
}

async function main() {
  const mode = (process.argv[2] || "dry-run").toLowerCase() as Mode
  if (!["dry-run", "apply", "verify"].includes(mode)) {
    console.error("Usage: ts-node scripts/backfill-channel-visibility.ts [dry-run|apply|verify]")
    process.exit(1)
  }
  if (mode === "dry-run") await runDryRun()
  else if (mode === "apply") await runApply()
  else await runVerify()
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
