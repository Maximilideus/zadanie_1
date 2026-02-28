interface CurrentUser {
  userId: string
  role: string
}

export function assertOwnership(ownerId: string, currentUser: CurrentUser) {
  if (currentUser.role === "ADMIN") return

  if (ownerId !== currentUser.userId) {
    throw new Error("FORBIDDEN")
  }
}

export function assertAppointmentOwnership(
  appointment: { clientId: string; masterId: string },
  currentUser: CurrentUser
) {
  if (currentUser.role === "ADMIN") return

  const isOwner =
    appointment.clientId === currentUser.userId ||
    appointment.masterId === currentUser.userId

  if (!isOwner) {
    throw new Error("FORBIDDEN")
  }
}
