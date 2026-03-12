import { prisma } from "../lib/prisma"
import { normalizePhone } from "../lib/phoneNormalize"

export interface TelegramUserInfo {
  username?: string
  firstName?: string
  lastName?: string
}

export interface FindOrCreateResult {
  customerId: string
  phone: string | null
}

/**
 * Find or create Customer for Telegram booking flow.
 * Priority: phone (if provided) -> telegramId.
 * Updates Customer telegram fields when creating or when telegramId was missing.
 */
export async function findOrCreateFromTelegram(
  telegramId: string,
  phone: string | null | undefined,
  telegramUser?: TelegramUserInfo
): Promise<FindOrCreateResult> {
  const normalizedPhone = phone ? normalizePhone(phone) : null
  const tid = String(telegramId)

  // 1. Find by phone if provided
  if (normalizedPhone && normalizedPhone.length > 0) {
    const byPhone = await prisma.customer.findUnique({
      where: { phone: normalizedPhone },
      select: { id: true, phone: true, telegramId: true },
    })
    if (byPhone) {
      // Update telegram linkage if missing or different
      const updates: { telegramId?: string; telegramUsername?: string; telegramFirstName?: string; telegramLastName?: string } = {}
      if (!byPhone.telegramId || byPhone.telegramId !== tid) updates.telegramId = tid
      if (telegramUser?.username != null) updates.telegramUsername = telegramUser.username
      if (telegramUser?.firstName != null) updates.telegramFirstName = telegramUser.firstName
      if (telegramUser?.lastName != null) updates.telegramLastName = telegramUser.lastName
      if (Object.keys(updates).length > 0) {
        await prisma.customer.update({
          where: { id: byPhone.id },
          data: updates,
        })
      }
      return { customerId: byPhone.id, phone: byPhone.phone }
    }
  }

  // 2. Find by telegramId
  const byTelegram = await prisma.customer.findUnique({
    where: { telegramId: tid },
    select: { id: true, phone: true, name: true },
  })
  if (byTelegram) {
    // Update phone if we have it and customer doesn't
    if (normalizedPhone && normalizedPhone.length > 0 && !byTelegram.phone) {
      await prisma.customer.update({
        where: { id: byTelegram.id },
        data: {
          phone: normalizedPhone,
          telegramUsername: telegramUser?.username,
          telegramFirstName: telegramUser?.firstName,
          telegramLastName: telegramUser?.lastName,
        },
      })
      return { customerId: byTelegram.id, phone: normalizedPhone }
    }
    // Update telegram profile fields
    const updates: { telegramUsername?: string; telegramFirstName?: string; telegramLastName?: string } = {}
    if (telegramUser?.username != null) updates.telegramUsername = telegramUser.username
    if (telegramUser?.firstName != null) updates.telegramFirstName = telegramUser.firstName
    if (telegramUser?.lastName != null) updates.telegramLastName = telegramUser.lastName
    if (Object.keys(updates).length > 0) {
      await prisma.customer.update({
        where: { id: byTelegram.id },
        data: updates,
      })
    }
    return { customerId: byTelegram.id, phone: byTelegram.phone }
  }

  // 3. Create new Customer
  const name = [telegramUser?.firstName, telegramUser?.lastName].filter(Boolean).join(" ").trim() || "Клиент"
  const created = await prisma.customer.create({
    data: {
      name,
      phone: normalizedPhone && normalizedPhone.length > 0 ? normalizedPhone : null,
      telegramId: tid,
      telegramUsername: telegramUser?.username ?? null,
      telegramFirstName: telegramUser?.firstName ?? null,
      telegramLastName: telegramUser?.lastName ?? null,
    },
    select: { id: true, phone: true },
  })
  return { customerId: created.id, phone: created.phone }
}

/**
 * Check if a Customer exists for this telegramId and has a phone number.
 * Used by bot to skip contact request when phone already known.
 */
export async function customerHasPhoneByTelegramId(telegramId: string): Promise<boolean> {
  const customer = await prisma.customer.findUnique({
    where: { telegramId: String(telegramId) },
    select: { phone: true },
  })
  return !!(customer?.phone && customer.phone.length > 0)
}
