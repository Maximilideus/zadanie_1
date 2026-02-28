import { FastifyInstance } from "fastify"
import { authenticate } from "../../middlewares/auth.middleware"
import { requireRole } from "../../middlewares/requireRole"

export async function adminRoutes(app: FastifyInstance) {
  app.get("/test", { preHandler: [authenticate, requireRole("ADMIN")] }, async () => {
    return { message: "ADMIN access granted" }
  })
}
