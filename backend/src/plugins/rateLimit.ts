import { FastifyInstance, FastifyPluginAsync } from "fastify"
import fp from "fastify-plugin"
import rateLimit from "@fastify/rate-limit"
import { env } from "../config/env"

const rateLimitPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  await app.register(rateLimit, {
    global: true,
    hook: "onRequest",
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, context) => {
      const err = new Error("Rate limit exceeded")
      Object.assign(err, { statusCode: context.statusCode })
      return err
    },
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
