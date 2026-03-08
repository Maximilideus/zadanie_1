import { PrismaClient } from "@prisma/client"
import bcrypt from "bcrypt"
import { seedCatalogItems } from "./seedCatalogItems"

const prisma = new PrismaClient()
const SALT_ROUNDS = 12
const MASTER_SEED_PASSWORD = "MasterSeed1!"

// --- 1) Location ---
const LOCATION = {
  name: "Main Salon",
  address: "TBD",
  timezone: "Europe/Ulyanovsk",
}

// --- 2) Masters (Users with role MASTER) ---
const MASTERS = [
  { name: "Anna", email: "anna.master@example.com" },
  { name: "Maria", email: "maria.master@example.com" },
  { name: "Elena", email: "elena.master@example.com" },
  { name: "Dmitriy", email: "dmitriy.master@example.com" },
] as const

// --- 3) Services: [name, durationMin, price] ---
const LASER_SERVICES: [string, number, number][] = [
  ["Laser 15 min", 15, 900],
  ["Laser 30 min", 30, 1700],
  ["Laser 45 min", 45, 2400],
  ["Laser 60 min", 60, 3000],
  ["Laser 90 min", 90, 4200],
  ["Laser 120 min", 120, 5200],
]
const ELECTRO_SERVICES: [string, number, number][] = [
  ["Electro 15 min", 15, 900],
  ["Electro 30 min", 30, 1700],
  ["Electro 45 min", 45, 2400],
  ["Electro 60 min", 60, 3000],
  ["Electro 90 min", 90, 4200],
  ["Electro 120 min", 120, 5200],
]
const WAXING_SERVICES: [string, number, number][] = [
  ["Waxing 15 min", 15, 1200],
  ["Waxing 25 min", 25, 1800],
  ["Waxing 35 min", 35, 2400],
  ["Waxing 50 min", 50, 3500],
  ["Waxing 60 min", 60, 3800],
]
const MASSAGE_SERVICES: [string, number, number][] = [
  ["Massage Classic 60 min", 60, 2000],
  ["Massage Relax 60 min", 60, 2000],
  ["Massage Sport 60 min", 60, 2200],
  ["Massage Lymph 60 min", 60, 2200],
]

// --- 4) Master -> categories (service name prefixes or full lists) ---
const MASTER_CATEGORIES: Record<string, ("Waxing" | "Electro" | "Laser" | "Massage")[]> = {
  "anna.master@example.com": ["Waxing", "Electro"],
  "maria.master@example.com": ["Electro", "Laser"],
  "elena.master@example.com": ["Waxing", "Massage"],
  "dmitriy.master@example.com": ["Massage"],
}

async function main() {
  const hashedPassword = await bcrypt.hash(MASTER_SEED_PASSWORD, SALT_ROUNDS)

  // --- 1) Location (upsert by name: findFirst + create) ---
  let locationRecord = await prisma.location.findFirst({ where: { name: LOCATION.name } })
  if (!locationRecord) {
    locationRecord = await prisma.location.create({ data: LOCATION })
  }

  // --- 2) Upsert Masters by email ---
  const masterIds: Record<string, string> = {}
  for (const m of MASTERS) {
    const user = await prisma.user.upsert({
      where: { email: m.email },
      create: {
        name: m.name,
        email: m.email,
        password: hashedPassword,
        role: "MASTER",
        state: "IDLE",
        locationId: locationRecord.id,
      },
      update: {
        name: m.name,
        role: "MASTER",
        state: "IDLE",
        locationId: locationRecord.id,
      },
    })
    masterIds[m.email] = user.id
  }

  // --- 3) Create services if missing (unique by name + locationId) ---
  const allServiceDefs: [string, number, number][] = [
    ...LASER_SERVICES,
    ...ELECTRO_SERVICES,
    ...WAXING_SERVICES,
    ...MASSAGE_SERVICES,
  ]
  const serviceIdsByName: Record<string, string> = {}
  for (const [name, durationMin, price] of allServiceDefs) {
    const existing = await prisma.service.findFirst({
      where: { name, locationId: locationRecord.id },
    })
    if (existing) {
      serviceIdsByName[name] = existing.id
    } else {
      const created = await prisma.service.create({
        data: { name, durationMin, price, locationId: locationRecord.id },
      })
      serviceIdsByName[name] = created.id
    }
  }

  // --- 4) Build serviceIds by category ---
  const serviceIdsByCategory: Record<string, string[]> = {
    Laser: LASER_SERVICES.map(([name]) => serviceIdsByName[name]),
    Electro: ELECTRO_SERVICES.map(([name]) => serviceIdsByName[name]),
    Waxing: WAXING_SERVICES.map(([name]) => serviceIdsByName[name]),
    Massage: MASSAGE_SERVICES.map(([name]) => serviceIdsByName[name]),
  }

  // --- 5) MasterService links (createMany with skipDuplicates) ---
  const masterServiceRows: { masterId: string; serviceId: string }[] = []
  for (const m of MASTERS) {
    const masterId = masterIds[m.email]
    const categories = MASTER_CATEGORIES[m.email]
    for (const cat of categories) {
      for (const serviceId of serviceIdsByCategory[cat]) {
        masterServiceRows.push({ masterId, serviceId })
      }
    }
  }
  await prisma.masterService.createMany({
    data: masterServiceRows,
    skipDuplicates: true,
  })

  await seedCatalogItems(prisma)

  // --- Summary ---
  const mastersCount = MASTERS.length
  const servicesCount = allServiceDefs.length
  const linksCount = await prisma.masterService.count()

  console.log("--- Seed summary ---")
  console.log("Location created:", locationRecord.name)
  console.log("Masters count:", mastersCount)
  console.log("Services count:", servicesCount)
  console.log("MasterService links count:", linksCount)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
