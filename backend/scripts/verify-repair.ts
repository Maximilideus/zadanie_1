import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
async function run() {
  const bookingIds = [
    "1ceae005-7bed-4321-b1c2-823ad2652740",
    "a0c7b5d9-ed22-4abc-a017-cf2225e6f638",
    "d3287fa8-c2ad-4588-b79a-4d3eb9fc3374",
    "11c21f79-c421-4b11-8d97-09bed03b770d",
  ]
  console.log("--- Bookings still point to same serviceId; Service.name now internal ---\n")
  for (const bid of bookingIds) {
    const b = await p.booking.findUnique({
      where: { id: bid },
      include: { service: { select: { id: true, name: true, category: true, durationMin: true } } },
    })
    if (b) console.log("Booking", bid, "serviceId", b.serviceId, "Service.name", b.service?.name)
  }
  const electro = await p.service.findUnique({
    where: { id: "ee12e08a-863b-4018-85d0-4d37e3c9dba3" },
    select: { name: true, durationMin: true },
  })
  const laser = await p.service.findUnique({
    where: { id: "8ee70369-2c4f-44f5-9d4e-076bf3f0b8c2" },
    select: { name: true, category: true },
  })
  console.log("\nElectro 120 row name:", electro?.name, "durationMin:", electro?.durationMin)
  console.log("Laser (ex-Ягодицы) row name:", laser?.name, "category:", laser?.category)
  const count = await p.booking.count({ where: { serviceId: "ee12e08a-863b-4018-85d0-4d37e3c9dba3" } })
  console.log("\nBookings still linked to Electro 120 min service:", count)
}
run()
  .then(() => process.exit(0))
  .finally(() => p.$disconnect())
