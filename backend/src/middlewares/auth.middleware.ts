import { FastifyRequest, FastifyReply } from "fastify"

export async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    throw new Error("FORBIDDEN")
  }
}
