import { prisma } from "../../lib/prisma"
import { Prisma } from "@prisma/client"

const appointmentSelect = {
  id: true,
  clientId: true,
  masterId: true,
  startAt: true,
  endAt: true,
  status: true,
  locationId: true,
  createdAt: true,
  client: { select: { id: true, name: true, email: true } },
  master: { select: { id: true, name: true, email: true } },
  services: {
    select: {
      service: { select: { id: true, name: true, durationMin: true, price: true } },
    },
  },
} satisfies Prisma.AppointmentSelect

export async function createAppointment(data: {
  clientId: string
  masterId: string
  locationId: string
  startAt: Date
  endAt: Date
  serviceIds?: string[]
}) {
  const { serviceIds, ...appointmentData } = data

  return prisma.appointment.create({
    data: {
      ...appointmentData,
      ...(serviceIds?.length && {
        services: {
          create: serviceIds.map((serviceId) => ({ serviceId })),
        },
      }),
    },
    select: appointmentSelect,
  })
}

export async function getAppointmentById(id: string) {
  return prisma.appointment.findUnique({
    where: { id },
    select: appointmentSelect,
  })
}

export async function getAppointments(filter: Prisma.AppointmentWhereInput = {}) {
  return prisma.appointment.findMany({
    where: filter,
    select: appointmentSelect,
    orderBy: { startAt: "desc" },
  })
}

export async function updateAppointment(
  id: string,
  data: { startAt?: Date; endAt?: Date; status?: string }
) {
  return prisma.appointment.update({
    where: { id },
    data,
    select: appointmentSelect,
  })
}

export async function deleteAppointment(id: string) {
  return prisma.appointment.delete({
    where: { id },
    select: { id: true },
  })
}
