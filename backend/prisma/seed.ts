import { PrismaClient } from "@prisma/client"
import bcrypt from "bcrypt"
import { env } from "../src/config/env"

const prisma = new PrismaClient()
const SALT_ROUNDS = 12

async function main() {
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  })

  if (existingAdmin) {
    console.log("Admin already exists:", existingAdmin.email)
  } else {
    const hashedPassword = await bcrypt.hash(env.ADMIN_PASSWORD, SALT_ROUNDS)

    await prisma.user.create({
      data: {
        name: "Admin",
        email: env.ADMIN_EMAIL,
        password: hashedPassword,
        role: "ADMIN",
      },
    })

    console.log("Admin created successfully:", env.ADMIN_EMAIL)
  }

  const clientEmail = "client@example.com"
  const clientPassword = "Client123!"

  const existingClient = await prisma.user.findUnique({
    where: { email: clientEmail },
  })

  if (existingClient) {
    console.log("Client already exists:", existingClient.email)
  } else {
    const hashedPassword = await bcrypt.hash(clientPassword, SALT_ROUNDS)

    await prisma.user.create({
      data: {
        name: "Client",
        email: clientEmail,
        password: hashedPassword,
        role: "CLIENT",
      },
    })

    console.log("Client created successfully:", clientEmail)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
