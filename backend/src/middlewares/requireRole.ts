import { FastifyRequest, FastifyReply } from "fastify"

type UserRole = "CLIENT" | "MASTER" | "ADMIN"

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userRole = request.user.role as UserRole

    if (!roles.includes(userRole)) {
      return reply.status(403).send({
        statusCode: 403,
        error: "Forbidden",
        message: "You do not have permission to access this resource",
      })
    }
  }
}
