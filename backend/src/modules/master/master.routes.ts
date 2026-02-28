import { FastifyInstance } from "fastify"
import { requireRole } from "../../middlewares/requireRole"
import { authenticate } from "../../middlewares/auth.middleware"
import {
  getMasters,
  getMasterById,
  createMaster,
  updateMaster,
  deleteMaster,
} from "./master.service"
import { createMasterSchema, updateMasterSchema, masterIdSchema } from "./master.schema"

export async function masterRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate] }, async () => {
    return getMasters()
  })

  app.get("/:id", { preHandler: [authenticate] }, async (request) => {
    const { id } = masterIdSchema.parse(request.params)
    const master = await getMasterById(id)
    if (!master) throw new Error("NOT_FOUND")
    return master
  })

  app.post("/", { preHandler: [authenticate, requireRole("ADMIN")] }, async (request, reply) => {
    const parsed = createMasterSchema.parse(request.body)
    const master = await createMaster(parsed)
    return reply.status(201).send(master)
  })

  app.put("/:id", { preHandler: [authenticate, requireRole("ADMIN")] }, async (request) => {
    const { id } = masterIdSchema.parse(request.params)
    const data = updateMasterSchema.parse(request.body)

    const existing = await getMasterById(id)
    if (!existing) throw new Error("NOT_FOUND")

    return updateMaster(id, data)
  })

  app.delete("/:id", { preHandler: [authenticate, requireRole("ADMIN")] }, async (request, reply) => {
    const { id } = masterIdSchema.parse(request.params)

    const existing = await getMasterById(id)
    if (!existing) throw new Error("NOT_FOUND")

    await deleteMaster(id)
    return reply.status(204).send()
  })
}
