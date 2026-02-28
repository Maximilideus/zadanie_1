import "dotenv/config"
import { z } from "zod"

const envSchema = z.object({
  PORT: z.string().default("3000"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  RATE_LIMIT_MAX: z.string().default("100"),
  RATE_LIMIT_WINDOW: z.string().default("60000"),
  JWT_SECRET: z.string().min(1),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(6),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error("Invalid environment variables")
  console.error(parsed.error.format())
  process.exit(1)
}

export const env = {
  PORT: Number(parsed.data.PORT),
  NODE_ENV: parsed.data.NODE_ENV,
  RATE_LIMIT_MAX: Number(parsed.data.RATE_LIMIT_MAX),
  RATE_LIMIT_WINDOW: Number(parsed.data.RATE_LIMIT_WINDOW),
  JWT_SECRET: parsed.data.JWT_SECRET,
  ADMIN_EMAIL: parsed.data.ADMIN_EMAIL,
  ADMIN_PASSWORD: parsed.data.ADMIN_PASSWORD,
}