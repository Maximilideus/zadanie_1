import { FastifyInstance } from "fastify"
import { getAllUsers, getUserById, createUser } from "./user.service"
import { createUserSchema } from "./user.schema"
import { authenticate } from "../../middlewares/auth.middleware"
import { requireRole } from "../../middlewares/requireRole"
import { changeStateHandler } from "./state.controller"

export async function userRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: [authenticate] }, async (request) => {
    const user = await getUserById(request.user.userId)
    if (!user) throw new Error("NOT_FOUND")
    return user
  })

  app.get("/", { preHandler: [authenticate] }, async () => {
    return getAllUsers()
  })

  app.post("/", { preHandler: [authenticate] }, async (request) => {
    const parsed = createUserSchema.parse(request.body)
    return createUser(parsed)
  })

  app.patch("/:id/state", {
    preHandler: [authenticate, requireRole("ADMIN")],
  }, changeStateHandler)
}
