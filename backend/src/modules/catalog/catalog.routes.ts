import type { FastifyInstance } from "fastify"
import { z } from "zod"
import {
  getCatalogByCategory,
  getCatalogByCategoryGrouped,
  getCatalogItemById,
} from "./catalog.service"

const categoryParamSchema = z.object({
  category: z.enum(["laser", "wax", "electro", "massage"]),
})

const badCategoryResponse = {
  statusCode: 400,
  error: "Bad Request",
  message:
    "Invalid catalog category. Allowed values: laser, wax, electro, massage",
} as const

const itemIdSchema = z.object({
  id: z.string().uuid(),
})

export async function catalogRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/item/:id", async (request, reply) => {
    const parseResult = itemIdSchema.safeParse(request.params)
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Invalid catalog item ID",
      })
    }
    const item = await getCatalogItemById(parseResult.data.id)
    if (!item) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Catalog item not found",
      })
    }
    return reply.send(item)
  })

  app.get<{
    Params: { category: string }
  }>("/:category/grouped", async (request, reply) => {
    const parseResult = categoryParamSchema.safeParse(request.params)
    if (!parseResult.success) {
      return reply.status(400).send(badCategoryResponse)
    }
    const { category } = parseResult.data
    const result = await getCatalogByCategoryGrouped(category)
    return reply.send(result)
  })

  app.get<{
    Params: { category: string }
  }>("/:category", async (request, reply) => {
    const parseResult = categoryParamSchema.safeParse(request.params)
    if (!parseResult.success) {
      return reply.status(400).send(badCategoryResponse)
    }
    const { category } = parseResult.data
    const result = await getCatalogByCategory(category)
    return reply.send(result)
  })
}

