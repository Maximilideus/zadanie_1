import { FastifyInstance } from "fastify"
import { getAllUsers, createUser } from "./user.service"
import { createUserSchema } from "./user.schema"

export async function userRoutes(app: FastifyInstance) {

  app.get("/", async () => {
    return getAllUsers()
  })

  app.post("/", async (request) => {
    const parsed = createUserSchema.parse(request.body)
    return createUser(parsed)
  })

}