import bcrypt from "bcrypt"
import { prisma } from "../../lib/prisma"

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) throw new Error("INVALID_CREDENTIALS")

  const valid = await bcrypt.compare(password, user.password)

  if (!valid) throw new Error("INVALID_CREDENTIALS")

  const { password: _, ...userWithoutPassword } = user
  return userWithoutPassword
}
