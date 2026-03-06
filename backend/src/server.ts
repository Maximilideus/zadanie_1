import packageJson from "../package.json"
import { env } from "./config/env"
import crypto from "node:crypto"
import Fastify from "fastify"
import prisma from "./lib/prisma"
import { userRoutes } from "./modules/user/user.routes"
import { masterRoutes } from "./modules/master/master.routes"
import { appointmentRoutes } from "./modules/appointment/appointment.routes"
import { authRoutes } from "./modules/auth/auth.routes"
import { adminRoutes } from "./modules/admin/admin.routes"
import { telegramRoutes } from "./modules/telegram/telegram.routes"
import { telegramBookingsRoutes } from "./routes/telegramBookings"
import { bookingStepsRoutes } from "./routes/telegram/bookingSteps"
import { telegramAvailabilityRoutes } from "./routes/telegramAvailability"
import { telegramMastersRoutes } from "./routes/telegramMasters"
import { telegramServicesRoutes } from "./routes/telegramServices"
import { bookingRoutes } from "./modules/booking/booking.routes"
import { catalogRoutes } from "./modules/catalog/catalog.routes"
import requestIdPlugin from "./plugins/requestId"
import rateLimitPlugin from "./plugins/rateLimit"
import jwtPlugin from "./plugins/jwt"
import { authenticate } from "./middlewares/auth.middleware"
import { startExpirePendingBookingsJob } from "./jobs/expirePendingBookings"
import cors from "@fastify/cors"

const app = Fastify({
  logger: true,
  genReqId: (req) => {
    const incoming = req.headers["x-request-id"]
    return typeof incoming === "string" && incoming.length > 0
      ? incoming
      : crypto.randomUUID()
  },
})

app.register(cors, {
  origin: ["http://localhost:5173"],
})

// Plugins
app.register(requestIdPlugin)
app.register(rateLimitPlugin)
app.register(jwtPlugin)

// Wait for plugins to load, then declare routes
  app.after(() => {
  app.decorate("authenticate", authenticate)

  // Health checks
  app.get("/ping", async () => {
    return { message: "pong" }
  })

  app.get("/health/database", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      return reply.status(200).send({ database: "ok" })
    } catch {
      return reply.status(503).send({ database: "error" })
    }
  })

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

  // Public routes
  app.register(authRoutes, { prefix: "/auth" })
  app.register(telegramRoutes, { prefix: "/telegram" })
  app.register(telegramBookingsRoutes, { prefix: "/telegram" })
  app.register(bookingStepsRoutes, { prefix: "/telegram" })
  app.register(telegramAvailabilityRoutes, { prefix: "/telegram" })
  app.register(telegramMastersRoutes, { prefix: "/telegram" })
  app.register(telegramServicesRoutes, { prefix: "/telegram" })
  app.register(catalogRoutes, { prefix: "/catalog" })

  // Protected routes
  app.register(userRoutes, { prefix: "/users" })
  app.register(masterRoutes, { prefix: "/masters" })
  app.register(appointmentRoutes, { prefix: "/appointments" })
  app.register(adminRoutes, { prefix: "/admin" })
  app.register(bookingRoutes, { prefix: "/bookings" })
})

// Global error handler
app.setErrorHandler((error, request, reply) => {
  const err = error as Error & { statusCode?: number; issues?: unknown; code?: string }

  if (err.message === "INVALID_CREDENTIALS") {
    return reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Invalid credentials",
    })
  }

  if (err.message === "FORBIDDEN") {
    return reply.status(403).send({
      statusCode: 403,
      error: "Forbidden",
      message: "You do not have access to this resource",
    })
  }

  if (err.message === "INVALID_TRANSITION") {
    return reply.status(409).send({
      statusCode: 409,
      error: "Conflict",
      message: "Invalid state transition",
    })
  }

  if (err.message === "INVALID_BOOKING_TRANSITION") {
    return reply.status(400).send({
      statusCode: 400,
      error: "Bad Request",
      message: "Invalid booking status transition",
    })
  }

  if (err.message === "ACTIVE_BOOKING_EXISTS") {
    return reply.status(409).send({
      statusCode: 409,
      error: "Conflict",
      message: "User already has an active booking",
    })
  }

  if (err.message === "NO_PENDING_BOOKING") {
    return reply.status(409).send({
      statusCode: 409,
      error: "Conflict",
      message: "No active PENDING booking for this user",
    })
  }

  if (err.message === "SELECT_SERVICE_FIRST") {
    return reply.status(409).send({
      statusCode: 409,
      error: "Conflict",
      message: "Select service first",
    })
  }

  if (err.message === "MASTER_CANNOT_PERFORM_SERVICE") {
    return reply.status(409).send({
      statusCode: 409,
      error: "Conflict",
      message: "Master cannot perform selected service",
    })
  }

  if (err.message === "INVALID_SCHEDULED_AT") {
    return reply.status(400).send({
      statusCode: 400,
      error: "Bad Request",
      message: "Invalid scheduledAt date",
    })
  }

  if (err.message === "INVALID_DATE") {
    return reply.status(400).send({
      statusCode: 400,
      error: "Bad Request",
      message: "Invalid date; use YYYY-MM-DD",
    })
  }

  if (err.message === "DATE_OUT_OF_RANGE") {
    return reply.status(400).send({
      statusCode: 400,
      error: "Bad Request",
      message: "Date must be within the next 60 days",
    })
  }

  if (err.message === "DATE_IS_TODAY") {
    return reply.status(400).send({
      statusCode: 400,
      error: "Bad Request",
      message: "Booking on the current day is not allowed",
    })
  }

  if (err.message === "NOT_FOUND") {
    return reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Resource not found",
    })
  }

  if (err.message === "Database schema is not synchronized. Please run prisma migrate.") {
    return reply.status(503).send({
      statusCode: 503,
      error: "Service Unavailable",
      message: err.message,
    })
  }

  if (err.statusCode === 429) {
    return reply.status(429).send({
      statusCode: 429,
      error: "Too Many Requests",
      message: "Rate limit exceeded",
    })
  }

  app.log.error(err)

  if (err.issues) {
    return reply.status(400).send({
      statusCode: 400,
      error: "Validation Error",
      message: "Invalid request data",
      details: err.issues,
    })
  }

  if (err.code === "P2002") {
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

let expireBookingsInterval: NodeJS.Timeout | null = null

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  app.log.info({ signal }, "Shutting down gracefully...")
  if (expireBookingsInterval) clearInterval(expireBookingsInterval)

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

process.on("SIGINT", () => gracefulShutdown("SIGINT"))
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))

// Start server
const start = async () => {
  try {
    await prisma.$connect()
    app.log.info("Database connected successfully")
    
    app.ready().then(() => {
      console.log(app.printRoutes())
    })

    await app.listen({ port: env.PORT })
    app.log.info(`Server running on http://localhost:${env.PORT}`)
  } catch (err) {
    app.log.error({ err }, "Failed to start server")
    process.exit(1)
  }
}

start()