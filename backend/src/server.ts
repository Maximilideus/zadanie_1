import packageJson from "../package.json"
import { env } from "./config/env"
import crypto from "node:crypto"
import Fastify from "fastify"
import prisma from "./lib/prisma"
import { userRoutes } from "./modules/user/user.routes"
import requestIdPlugin from "./plugins/requestId"
import rateLimitPlugin from "./plugins/rateLimit"

const app = Fastify({
  logger: true,
  genReqId: (req) => {
    const incoming = req.headers["x-request-id"]
    return typeof incoming === "string" && incoming.length > 0
      ? incoming
      : crypto.randomUUID()
  },
})

// Plugins
app.register(requestIdPlugin)
app.register(rateLimitPlugin)

// Health check
app.get("/ping", async () => {
  return { message: "pong" }
})

// Routes
app.register(userRoutes, { prefix: "/users" })

// Global error handler
app.setErrorHandler((error, request, reply) => {
  app.log.error(error)

  // Zod validation error
  if ((error as any).issues) {
    return reply.status(400).send({
      statusCode: 400,
      error: "Validation Error",
      message: "Invalid request data",
      details: (error as any).issues,
    })
  }

  // Prisma unique constraint
  if ((error as any).code === "P2002") {
    return reply.status(409).send({
      statusCode: 409,
      error: "Conflict",
      message: "Unique field already exists",
    })
  }

  return reply.status(500).send({
    statusCode: 500,
    error: "Internal Server Error",
    message: "Something went wrong",
  })
})

// Start server
const start = async () => {
  try {
    // 1️⃣ Подключаемся к БД (fail-fast)
    await prisma.$connect()
    app.log.info("Database connected successfully")

    // 2️⃣ Запускаем сервер
    await app.listen({ port: env.PORT })
    app.log.info(`Server running on http://localhost:${env.PORT}`)
  } catch (err) {
    app.log.error({ err }, "Failed to start server")
    process.exit(1)
  }
}

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  app.log.info({ signal }, "Shutting down gracefully...")

  try {
    await app.close()
    await prisma.$disconnect()

    app.log.info("Server closed successfully")
    process.exit(0)
  } catch (err) {
    app.log.error({ err }, "Error during shutdown")
    process.exit(1)
  }
}

// Signals
process.on("SIGINT", () => gracefulShutdown("SIGINT"))
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))

app.get("/health", async (request, reply) => {
  const uptime = process.uptime()
  const timestamp = new Date().toISOString()

  try {
    await prisma.$queryRaw`SELECT 1`

    return reply.status(200).send({
      status: "ok",
      version: packageJson.version,
      uptime,
      timestamp,
      database: "connected",
    })
  } catch (err) {
    app.log.error({ err }, "Health check failed")

    return reply.status(500).send({
      status: "error",
      version: packageJson.version,
      uptime,
      timestamp,
      database: "disconnected",
    })
  }
})


start()