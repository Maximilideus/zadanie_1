import { FastifyInstance, FastifyPluginAsync } from "fastify"
import fp from "fastify-plugin"
import rateLimit from "@fastify/rate-limit"
import { env } from "../config/env"

const rateLimitPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
      retryAfter: Math.ceil(context.ttl / 1000),
    }),
  })

  app.log.info(
    { max: env.RATE_LIMIT_MAX, windowMs: env.RATE_LIMIT_WINDOW },
    "Rate limiting enabled"
  )
}

export default fp(rateLimitPlugin, {
  name: "rate-limit",
  fastify: "5.x",
})
