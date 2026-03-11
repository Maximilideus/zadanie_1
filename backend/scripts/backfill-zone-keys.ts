/**
 * Backfill Service.zoneKey from Service.name using a deterministic mapping.
 *
 * zoneKey is a stable semantic identifier for a body zone.
 * Same zone across genders shares the same zoneKey.
 * zoneKey must not change when Service.name changes — it is frozen after this backfill.
 *
 * Modes: dry-run | apply | verify
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Mode = "dry-run" | "apply" | "verify";

// ──────────────────────── Deterministic name → zoneKey mapping ────────────────────────
// Every known Russian service name maps to a stable English slug.
// Services with null category (pre-existing English-named rows) are mapped separately.

const ZONE_KEY_MAP: Record<string, string> = {
  // LASER / WAX body zones
  "Бёдра": "thighs",
  "Голени": "lower-legs",
  "Грудь": "chest",
  "Живот": "abdomen",
  "Живот (линия)": "abdomen-line",
  "Живот полностью": "abdomen-full",
  "Ноги полностью": "full-legs",
  "Плечи": "shoulders",
  "Подмышки": "armpits",
  "Предплечья": "forearms",
  "Руки полностью": "full-arms",
  "Спина полностью": "full-back",
  "Ягодицы": "buttocks",

  // LASER / WAX intimate zones
  "Бикини глубокое": "deep-bikini",
  "Бикини классическое": "classic-bikini",
  "Тотальное бикини": "total-bikini",
  "Интимная зона (мужская)": "male-intimate",

  // LASER / WAX face zones
  "Верхняя губа": "upper-lip",
  "Лицо полностью": "full-face",
  "Подбородок": "chin",
  "Щёки и скулы": "cheeks",
  "Борода (контур / шея)": "beard-contour",
  "Шея / контур бороды": "beard-contour",

  // ELECTRO time slots
  "15 минут": "electro-15",
  "30 минут": "electro-30",
  "45 минут": "electro-45",
  "60 минут": "electro-60",
  "90 минут": "electro-90",
  "120 минут": "electro-120",

  // MASSAGE types
  "Классический массаж": "massage-classic",
  "Лимфодренажный массаж": "massage-lymph",
  "Расслабляющий массаж": "massage-relax",
  "Спортивный массаж": "massage-sport",
};

// Pre-existing English-named services (no category/gender)
const ENGLISH_ZONE_KEY_MAP: Record<string, string> = {
  "Laser 15 min": "electro-15",
  "Laser 30 min": "electro-30",
  "Laser 45 min": "electro-45",
  "Laser 60 min": "electro-60",
  "Laser 90 min": "electro-90",
  "Laser 120 min": "electro-120",
  "Electro 15 min": "electro-15",
  "Electro 30 min": "electro-30",
  "Electro 45 min": "electro-45",
  "Electro 60 min": "electro-60",
  "Electro 90 min": "electro-90",
  "Electro 120 min": "electro-120",
  "Waxing 15 min": "wax-15",
  "Waxing 25 min": "wax-25",
  "Waxing 35 min": "wax-35",
  "Waxing 50 min": "wax-50",
  "Waxing 60 min": "wax-60",
  "Massage Classic 60 min": "massage-classic",
  "Massage Lymph 60 min": "massage-lymph",
  "Massage Relax 60 min": "massage-relax",
  "Massage Sport 60 min": "massage-sport",
};

function resolveZoneKey(name: string, category: string | null): string | null {
  if (category) {
    return ZONE_KEY_MAP[name] ?? null;
  }
  return ENGLISH_ZONE_KEY_MAP[name] ?? null;
}

// ──────────────────────── Dry Run ────────────────────────

async function runDryRun() {
  const services = await prisma.service.findMany({
    select: { id: true, name: true, category: true, gender: true, zoneKey: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  let mapped = 0;
  let alreadySet = 0;
  let unmapped = 0;
  const unmappedNames: string[] = [];

  for (const svc of services) {
    const key = resolveZoneKey(svc.name, svc.category);
    if (svc.zoneKey) {
      alreadySet++;
    } else if (key) {
      mapped++;
    } else {
      unmapped++;
      unmappedNames.push(`"${svc.name}" [${svc.category ?? "null"}] gender=${svc.gender}`);
    }
  }

  console.log("[backfill-zone-keys] dry-run:");
  console.log(`  Services scanned:     ${services.length}`);
  console.log(`  To set zoneKey:       ${mapped}`);
  console.log(`  Already have zoneKey: ${alreadySet}`);
  console.log(`  Unmapped (no key):    ${unmapped}`);
  if (unmappedNames.length > 0) {
    console.log("  Unmapped services:");
    unmappedNames.forEach((n) => console.log(`    ${n}`));
  }
}

// ──────────────────────── Apply ────────────────────────

async function runApply() {
  const services = await prisma.service.findMany({
    select: { id: true, name: true, category: true, zoneKey: true },
  });

  let updated = 0;
  let skipped = 0;
  let unmapped = 0;
  let failed = 0;

  for (const svc of services) {
    if (svc.zoneKey) {
      skipped++;
      continue;
    }
    const key = resolveZoneKey(svc.name, svc.category);
    if (!key) {
      unmapped++;
      console.log(`  [unmapped] "${svc.name}" [${svc.category ?? "null"}]`);
      continue;
    }
    try {
      await prisma.service.update({
        where: { id: svc.id },
        data: { zoneKey: key },
      });
      updated++;
    } catch (e) {
      failed++;
      console.error(`  [failed] ${svc.id} "${svc.name}":`, e);
    }
  }

  console.log("[backfill-zone-keys] apply done:");
  console.log(`  Updated:  ${updated}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Unmapped: ${unmapped}`);
  console.log(`  Failed:   ${failed}`);
}

// ──────────────────────── Verify ────────────────────────

async function runVerify() {
  let ok = true;

  const services = await prisma.service.findMany({
    where: { category: { not: null } },
    select: { id: true, name: true, category: true, gender: true, zoneKey: true, locationId: true },
    orderBy: [{ category: "asc" }, { zoneKey: "asc" }, { gender: "asc" }],
  });

  const withKey = services.filter((s) => s.zoneKey);
  const withoutKey = services.filter((s) => !s.zoneKey);

  console.log("[backfill-zone-keys] verify:");
  console.log(`  Migrated services with zoneKey:    ${withKey.length}`);
  console.log(`  Migrated services without zoneKey: ${withoutKey.length}`);

  if (withoutKey.length > 0) {
    console.error("  Services missing zoneKey:");
    withoutKey.forEach((s) => console.error(`    "${s.name}" [${s.category}] gender=${s.gender}`));
    ok = false;
  }

  // Cross-gender pairs: group by (category, locationId, zoneKey) and check gender coverage
  const groups = new Map<string, typeof services>();
  for (const s of withKey) {
    const key = `${s.category}|${s.locationId}|${s.zoneKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  let crossGenderPairs = 0;
  let singleGenderZones = 0;

  console.log("\n  --- Zone coverage by (category, zoneKey) ---");
  for (const [key, group] of groups) {
    const genders = [...new Set(group.map((s) => s.gender))];
    const names = [...new Set(group.map((s) => s.name))];
    if (genders.length > 1) {
      crossGenderPairs++;
      console.log(`  [cross-gender] ${group[0].category} zoneKey="${group[0].zoneKey}": ${genders.join(", ")} → names: ${names.map(n => `"${n}"`).join(", ")}`);
    } else {
      singleGenderZones++;
      console.log(`  [single] ${group[0].category} zoneKey="${group[0].zoneKey}": ${genders[0]} only → "${names[0]}"`);
    }
  }

  console.log(`\n  Cross-gender zone pairs: ${crossGenderPairs}`);
  console.log(`  Single-gender zones:     ${singleGenderZones}`);

  // Verify same zoneKey → same name across genders (informational; names CAN differ)
  for (const [key, group] of groups) {
    const names = [...new Set(group.map((s) => s.name))];
    if (names.length > 1) {
      console.log(`  [info] ${group[0].category} zoneKey="${group[0].zoneKey}" has different display names: ${names.map(n => `"${n}"`).join(", ")}`);
    }
  }

  // Verify existing packages still valid
  const normalized = await prisma.package.findMany({
    where: { sourceLegacyPackageId: { not: null } },
    include: {
      services: {
        include: { service: { select: { id: true, name: true, price: true, durationMin: true, gender: true, zoneKey: true } } },
      },
    },
  });

  console.log(`\n  --- Package integrity check (${normalized.length} normalized packages) ---`);
  for (const pkg of normalized) {
    const expectedPrice = pkg.services.reduce((s, ps) => s + ps.service.price, 0);
    const expectedDuration = pkg.services.reduce((s, ps) => s + ps.service.durationMin, 0);
    if (pkg.price !== expectedPrice || pkg.durationMin !== expectedDuration) {
      console.error(`  [FAIL] "${pkg.name}" variant=${pkg.normalizedVariantKey}: price/duration mismatch`);
      ok = false;
    }
    for (const ps of pkg.services) {
      if (pkg.gender && ps.service.gender !== pkg.gender) {
        console.error(`  [FAIL] "${pkg.name}" variant=${pkg.normalizedVariantKey}: service "${ps.service.name}" gender mismatch`);
        ok = false;
      }
      if (!ps.service.zoneKey) {
        console.error(`  [FAIL] "${pkg.name}" variant=${pkg.normalizedVariantKey}: service "${ps.service.name}" missing zoneKey`);
        ok = false;
      }
    }
    const svcList = pkg.services.map((ps) => `${ps.service.name}[${ps.service.zoneKey}]`).join(" + ");
    console.log(`  [OK] "${pkg.name}" variant=${pkg.normalizedVariantKey}: ${svcList}`);
  }

  if (ok) {
    console.log("\n  ✓ VERIFY PASSED");
  } else {
    console.error("\n  ✗ VERIFY FAILED");
    process.exitCode = 1;
  }
}

// ──────────────────────── Main ────────────────────────

async function main() {
  const mode = (process.argv[2] || "dry-run").toLowerCase() as Mode;
  if (!["dry-run", "apply", "verify"].includes(mode)) {
    console.error("Usage: ts-node scripts/backfill-zone-keys.ts [dry-run|apply|verify]");
    process.exit(1);
  }

  if (mode === "dry-run") await runDryRun();
  else if (mode === "apply") await runApply();
  else await runVerify();
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error("[backfill-zone-keys] Fatal:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
