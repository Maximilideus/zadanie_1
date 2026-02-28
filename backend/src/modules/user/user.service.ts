import bcrypt from "bcrypt"
import { prisma } from "../../lib/prisma"

const userSelectPublic = {
  id: true,
  name: true,
  email: true,
  role: true,
  state: true,
  locationId: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function getAllUsers() {
  return prisma.user.findMany({ select: userSelectPublic })
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: userSelectPublic,
  })
}

export async function createUser(data: {
  name: string
  email: string
  password: string
  role: "CLIENT" | "MASTER" | "ADMIN"
}) {
  const hashedPassword = await bcrypt.hash(data.password, 10)

  return prisma.user.create({
    data: { ...data, password: hashedPassword },
    select: userSelectPublic,
  })
}