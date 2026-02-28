import { prisma } from "../../lib/prisma"

export async function getAllUsers() {
  return prisma.user.findMany()
}

export async function createUser(data: any) {
  return prisma.user.create({
    data,
  })
}