import { FastifyInstance, FastifyPluginAsync } from "fastify"
import fp from "fastify-plugin"
import crypto from "node:crypto"

declare module "fastify" {
  interface FastifyRequest {
    requestId: string
  }
}

const requestIdPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook("onRequest", async (request, reply) => {
    const incoming = request.headers["x-request-id"]
    const id =
      typeof incoming === "string" && incoming.length > 0
        ? incoming
        : crypto.randomUUID()

    request.requestId = id
    reply.header("x-request-id", id)

    request.log.info({ requestId: id, method: request.method, url: request.url }, "incoming request")
  })

  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        requestId: request.requestId,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      "request completed"
    )
  })
}

export default fp(requestIdPlugin, {
  name: "request-id",
  fastify: "5.x",
})
