import { FastifyInstance } from "fastify"
import {
  getAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment,
} from "./appointment.service"
import {
  appointmentIdSchema,
  createAppointmentSchema,
  updateAppointmentSchema,
} from "./appointment.schema"
import { authenticate } from "../../middlewares/auth.middleware"
import { requireRole } from "../../middlewares/requireRole"
import { assertAppointmentOwnership } from "../../middlewares/checkOwnership"

export async function appointmentRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const { userId, role } = request.user

    switch (role) {
      case "ADMIN":
        return getAppointments()
      case "CLIENT":
        return getAppointments({ clientId: userId })
      case "MASTER":
        return getAppointments({ masterId: userId })
      default:
        return getAppointments({ clientId: userId })
    }
  })

  app.get("/:id", { preHandler: [authenticate] }, async (request) => {
    const { id } = appointmentIdSchema.parse(request.params)
    const appointment = await getAppointmentById(id)

    if (!appointment) throw new Error("NOT_FOUND")

    assertAppointmentOwnership(appointment, request.user)

    return appointment
  })

  app.post("/", { preHandler: [authenticate, requireRole("CLIENT")] }, async (request, reply) => {
    const parsed = createAppointmentSchema.parse(request.body)

    const appointment = await createAppointment({
      clientId: request.user.userId,
      masterId: parsed.masterId,
      locationId: parsed.locationId,
      startAt: new Date(parsed.startAt),
      endAt: new Date(parsed.endAt),
      serviceIds: parsed.serviceIds,
    })

    return reply.status(201).send(appointment)
  })

  app.put("/:id", { preHandler: [authenticate] }, async (request) => {
    const { id } = appointmentIdSchema.parse(request.params)
    const data = updateAppointmentSchema.parse(request.body)

    const existing = await getAppointmentById(id)
    if (!existing) throw new Error("NOT_FOUND")

    assertAppointmentOwnership(existing, request.user)

    return updateAppointment(id, {
      ...(data.startAt && { startAt: new Date(data.startAt) }),
      ...(data.endAt && { endAt: new Date(data.endAt) }),
      ...(data.status && { status: data.status }),
    })
  })

  app.delete("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = appointmentIdSchema.parse(request.params)

    const existing = await getAppointmentById(id)
    if (!existing) throw new Error("NOT_FOUND")

    assertAppointmentOwnership(existing, request.user)

    await deleteAppointment(id)
    return reply.status(204).send()
  })
}
