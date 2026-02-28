import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify"
import fp from "fastify-plugin"
import jwt from "@fastify/jwt"
import { env } from "../config/env"

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { userId: string; role: string }
    user: { userId: string; role: string }
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

const jwtPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: "15m" },
  })
}

export default fp(jwtPlugin, {
  name: "jwt",
  fastify: "5.x",
})
