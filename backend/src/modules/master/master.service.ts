import bcrypt from "bcrypt"
import { prisma } from "../../lib/prisma"

const masterSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  locationId: true,
  location: { select: { id: true, name: true, address: true } },
  createdAt: true,
  updatedAt: true,
} as const

export async function getMasters() {
  return prisma.user.findMany({
    where: { role: "MASTER" },
    select: masterSelect,
    orderBy: { name: "asc" },
  })
}

export async function getMasterById(id: string) {
  return prisma.user.findFirst({
    where: { id, role: "MASTER" },
    select: masterSelect,
  })
}

export async function createMaster(data: {
  name: string
  email: string
  password: string
  locationId?: string
}) {
  const hashedPassword = await bcrypt.hash(data.password, 10)

  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: "MASTER",
      locationId: data.locationId,
    },
    select: masterSelect,
  })
}

export async function updateMaster(
  id: string,
  data: { name?: string; email?: string; locationId?: string | null }
) {
  return prisma.user.update({
    where: { id },
    data,
    select: masterSelect,
  })
}

export async function deleteMaster(id: string) {
  return prisma.user.delete({
    where: { id },
    select: { id: true },
  })
}
