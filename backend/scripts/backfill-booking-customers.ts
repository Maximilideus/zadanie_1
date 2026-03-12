/**
 * Backfill Customer records for legacy bookings.
 * Creates/finds Customer by telegramId or name, links booking.customerId, sets source=BOT.
 *
 * Modes: dry-run | apply | verify
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

type Mode = "dry-run" | "apply" | "verify"

async function runDryRun() {
  const bookings = await prisma.booking.findMany({
    where: { customerId: null },
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          id: true,
          name: true,
          telegramId: true,
          email: true,
        },
      },
    },
  })

  let scannedBookings = bookings.length
  let createdCustomers = 0
  let linkedBookings = 0
  let alreadyLinked = 0
  let missingLegacyData = 0
  let ambiguousMatches = 0

  const seenTelegramIds = new Set<string>()
  const seenNames = new Map<string, number>()

  for (const b of bookings) {
    const user = b.user
    if (!user) {
      missingLegacyData++
      continue
    }

    if (user.telegramId) {
      const existing = await prisma.customer.findUnique({
        where: { telegramId: user.telegramId },
        select: { id: true },
      })
      if (existing) {
        linkedBookings++
      } else {
        if (seenTelegramIds.has(user.telegramId)) {
          ambiguousMatches++
        } else {
          seenTelegramIds.add(user.telegramId)
          createdCustomers++
          linkedBookings++
        }
      }
    } else {
      const nameCount = seenNames.get(user.name) ?? 0
      seenNames.set(user.name, nameCount + 1)
      if (nameCount > 0) {
        ambiguousMatches++
      }
      const byName = await prisma.customer.findMany({
        where: { name: user.name, telegramId: null },
        select: { id: true },
      })
      if (byName.length > 1) {
        ambiguousMatches++
      } else if (byName.length === 1) {
        linkedBookings++
      } else {
        createdCustomers++
        linkedBookings++
      }
    }
  }

  const totalWithCustomer = await prisma.booking.count({ where: { customerId: { not: null } } })
  alreadyLinked = totalWithCustomer

  console.log("[backfill-booking-customers] dry-run:")
  console.log("  scannedBookings:   ", scannedBookings)
  console.log("  createdCustomers:  ", createdCustomers)
  console.log("  linkedBookings:    ", linkedBookings)
  console.log("  alreadyLinked:     ", alreadyLinked)
  console.log("  missingLegacyData: ", missingLegacyData)
  console.log("  ambiguousMatches:  ", ambiguousMatches)
}

async function runApply() {
  const bookings = await prisma.booking.findMany({
    where: { customerId: null },
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          id: true,
          name: true,
          telegramId: true,
          email: true,
        },
      },
    },
  })

  let scannedBookings = bookings.length
  let createdCustomers = 0
  let linkedBookings = 0
  let alreadyLinked = 0
  let missingLegacyData = 0
  let ambiguousMatches = 0

  for (const b of bookings) {
    const user = b.user
    if (!user) {
      missingLegacyData++
      continue
    }

    let customerId: string | null = null

    if (user.telegramId) {
      let customer = await prisma.customer.findUnique({
        where: { telegramId: user.telegramId },
      })
      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            name: user.name,
            telegramId: user.telegramId,
          },
        })
        createdCustomers++
      }
      customerId = customer.id
    } else {
      const byName = await prisma.customer.findMany({
        where: { name: user.name, telegramId: null },
      })
      if (byName.length > 1) {
        ambiguousMatches++
        continue
      }
      let customer = byName[0] ?? null
      if (!customer) {
        customer = await prisma.customer.create({
          data: { name: user.name },
        })
        createdCustomers++
      }
      customerId = customer.id
    }

    await prisma.booking.update({
      where: { id: b.id },
      data: { customerId, source: "BOT" },
    })
    linkedBookings++
  }

  alreadyLinked = await prisma.booking.count({ where: { customerId: { not: null } } }) - linkedBookings

  console.log("[backfill-booking-customers] apply done:")
  console.log("  scannedBookings:   ", scannedBookings)
  console.log("  createdCustomers: ", createdCustomers)
  console.log("  linkedBookings:    ", linkedBookings)
  console.log("  alreadyLinked:     ", alreadyLinked)
  console.log("  missingLegacyData: ", missingLegacyData)
  console.log("  ambiguousMatches:  ", ambiguousMatches)
}

async function runVerify() {
  const total = await prisma.booking.count()
  const withCustomer = await prisma.booking.count({ where: { customerId: { not: null } } })
  const withoutCustomer = await prisma.booking.count({ where: { customerId: null } })

  console.log("[backfill-booking-customers] verify:")
  console.log("  total bookings:    ", total)
  console.log("  with customerId:   ", withCustomer)
  console.log("  without customerId:", withoutCustomer)

  const ok = withoutCustomer === 0 || total === 0
  console.log(ok ? "\n  ✓ VERIFY PASSED" : "\n  ✗ VERIFY FAILED (some bookings still lack customerId)")
  if (!ok) process.exitCode = 1
}

async function main() {
  const mode = (process.argv[2] || "dry-run").toLowerCase() as Mode
  if (!["dry-run", "apply", "verify"].includes(mode)) {
    console.error(
      "Usage: npx ts-node scripts/backfill-booking-customers.ts [dry-run|apply|verify]"
    )
    process.exit(1)
  }
  if (mode === "dry-run") await runDryRun()
  else if (mode === "apply") await runApply()
  else await runVerify()
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error("[backfill-booking-customers] Fatal:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
