import type { Context } from "grammy"
import { InlineKeyboard } from "grammy"
import {
  getCatalogGrouped,
  getCatalogItemById,
  type CatalogGroupedResponse,
  type CatalogGroupSection,
  type CatalogItemDto,
} from "../api/backend.client.js"
import {
  setBookingSession,
  clearBookingSession,
  getBookingSession,
  startWizardWithService,
  type BookingSession,
} from "./bookingFlow.js"
import { formatServiceDisplayName } from "../services/formatters.js"
import { formatCatalogIntro } from "../services/deeplink.js"

export type CategorySlug = "laser" | "wax" | "electro" | "massage"

const CATEGORY_BUTTONS: { slug: CategorySlug; label: string }[] = [
  { slug: "laser", label: "Лазерная депиляция" },
  { slug: "wax", label: "Восковая депиляция" },
  { slug: "electro", label: "Электроэпиляция" },
  { slug: "massage", label: "Массаж" },
]

const CATEGORY_ENUM: Record<CategorySlug, string> = {
  laser: "LASER",
  wax: "WAX",
  electro: "ELECTRO",
  massage: "MASSAGE",
}

const SLUG_FROM_ENUM: Record<string, CategorySlug> = {
  LASER: "laser",
  WAX: "wax",
  ELECTRO: "electro",
  MASSAGE: "massage",
}

const CATEGORY_LABEL_RU: Record<string, string> = {
  laser: "Лазерная депиляция",
  wax: "Восковая депиляция",
  electro: "Электроэпиляция",
  massage: "Массаж",
}

const GROUP_KEY_TITLES: Record<string, string> = {
  face: "Лицо",
  body: "Тело",
  intimate: "Интимная зона",
  time: "Пакеты времени",
  info: "Информация",
  other: "Другое",
}

const GENDER_LABELS: Record<string, string> = {
  female: "Женщинам",
  male: "Мужчинам",
  unisex: "",
}

function groupTitle(key: string): string {
  return GROUP_KEY_TITLES[key] ?? key
}

function priceLabel(price: number | null): string {
  return price != null ? `${price} ₽` : ""
}

export function categorySlugFromSession(session: BookingSession): CategorySlug | undefined {
  if (!session.category) return undefined
  return SLUG_FROM_ENUM[session.category]
}

// ── Top-level category selection ────────────────────────────────────

export async function showCategorySelection(ctx: Context): Promise<void> {
  const from = ctx.from
  if (!from) return

  const session = getBookingSession(from.id)
  const wiz = session.wizardMessageId
  clearBookingSession(from.id)
  setBookingSession(from.id, { step: "catalog", wizardMessageId: wiz })

  const keyboard = new InlineKeyboard()
  for (const cat of CATEGORY_BUTTONS) {
    keyboard.text(cat.label, `cat:${cat.slug}`).row()
  }

  await editOrSend(ctx, from.id, "Выберите категорию услуги:", keyboard)
}

// ── Category chosen → show gender/group selection ───────────────────

export async function onCategoryChosen(ctx: Context, slug: CategorySlug): Promise<void> {
  const from = ctx.from
  if (!from) return

  const categoryEnum = CATEGORY_ENUM[slug]
  setBookingSession(from.id, { category: categoryEnum })

  let grouped: CatalogGroupedResponse
  try {
    grouped = await getCatalogGrouped(slug)
  } catch {
    await editOrSend(ctx, from.id, "Не удалось загрузить каталог. Попробуйте позже.", new InlineKeyboard())
    return
  }

  const sections = grouped.sections

  if (slug === "massage") {
    await showMassageTypes(ctx, from.id, sections)
    return
  }

  if (slug === "electro") {
    await showElectroTimeServices(ctx, from.id, sections)
    return
  }

  // Laser / Wax: check if multiple genders
  const genderKeys = Object.keys(sections)
  if (genderKeys.length === 0) {
    await editOrSend(ctx, from.id, "В этой категории пока нет позиций.", new InlineKeyboard())
    return
  }

  if (genderKeys.length === 1 && genderKeys[0]) {
    setBookingSession(from.id, { catalogGender: genderKeys[0] })
    await showZoneGroups(ctx, from.id, slug, genderKeys[0], sections[genderKeys[0]]!, false)
    return
  }

  const keyboard = new InlineKeyboard()
  for (const gk of genderKeys) {
    const label = GENDER_LABELS[gk] ?? gk
    if (label) {
      keyboard.text(label, `gender:${slug}:${gk}`).row()
    }
  }
  keyboard.text("◀️ Назад", "cat_back")
  await editOrSend(ctx, from.id, `${CATEGORY_LABEL_RU[slug] ?? slug}\n\nДля кого выбираем зону?`, keyboard)
}

// ── Gender chosen → show zone groups ────────────────────────────────

export async function onGenderChosen(
  ctx: Context,
  slug: CategorySlug,
  genderKey: string,
): Promise<void> {
  const from = ctx.from
  if (!from) return

  let grouped: CatalogGroupedResponse
  try {
    grouped = await getCatalogGrouped(slug)
  } catch {
    await editOrSend(ctx, from.id, "Не удалось загрузить каталог. Попробуйте позже.", new InlineKeyboard())
    return
  }

  const genderSections = grouped.sections[genderKey]
  if (!genderSections) {
    await editOrSend(ctx, from.id, "В этой категории пока нет позиций.", new InlineKeyboard())
    return
  }

  setBookingSession(from.id, { catalogGender: genderKey })
  await showZoneGroups(ctx, from.id, slug, genderKey, genderSections, true)
}

async function showZoneGroups(
  ctx: Context,
  telegramId: number,
  slug: CategorySlug,
  genderKey: string,
  genderSections: Record<string, CatalogGroupSection>,
  hasGenderStep: boolean,
): Promise<void> {
  const groupKeys = Object.keys(genderSections).filter((k) => k !== "info")

  if (groupKeys.length === 0) {
    await editOrSend(ctx, telegramId, "Нет доступных зон.", new InlineKeyboard())
    return
  }

  const keyboard = new InlineKeyboard()
  for (const gk of groupKeys) {
    keyboard.text(groupTitle(gk), `zgrp:${slug}:${genderKey}:${gk}`).row()
  }
  keyboard.text("📋 Несколько зон или консультация", `consult:${slug}`).row()
  keyboard.text("◀️ Назад", hasGenderStep ? `cat:${slug}` : "cat_back")

  const genderLabel = GENDER_LABELS[genderKey]
  const header = genderLabel
    ? `${CATEGORY_LABEL_RU[slug] ?? slug} (${genderLabel.toLowerCase()})`
    : CATEGORY_LABEL_RU[slug] ?? slug

  await editOrSend(ctx, telegramId, `${header}\n\nВыберите зону:`, keyboard)
}

// ── Zone group chosen → show concrete items ─────────────────────────

export async function onZoneGroupChosen(
  ctx: Context,
  slug: CategorySlug,
  genderKey: string,
  groupKey: string,
): Promise<void> {
  const from = ctx.from
  if (!from) return

  let grouped: CatalogGroupedResponse
  try {
    grouped = await getCatalogGrouped(slug)
  } catch {
    await editOrSend(ctx, from.id, "Не удалось загрузить каталог. Попробуйте позже.", new InlineKeyboard())
    return
  }

  const items = grouped.sections[genderKey]?.[groupKey]?.items
  if (!items || items.length === 0) {
    await editOrSend(ctx, from.id, "В этой зоне пока нет позиций.", new InlineKeyboard())
    return
  }

  setBookingSession(from.id, { catalogGroupKey: groupKey })

  const keyboard = new InlineKeyboard()
  for (const item of items) {
    if (item.type === "INFO") continue
    const price = priceLabel(item.price)
    const label = price ? `${item.title} — ${price}` : item.title
    keyboard.text(label, `ci:${item.id}`).row()
  }
  keyboard.text("📋 Несколько зон или консультация", `consult:${slug}`).row()
  keyboard.text("◀️ Назад", `gender:${slug}:${genderKey}`)

  const header = `${CATEGORY_LABEL_RU[slug] ?? slug} — ${groupTitle(groupKey)}`
  await editOrSend(ctx, from.id, `${header}\n\nВыберите позицию:`, keyboard)
}

// ── Catalog item chosen → resolve and start booking ─────────────────

export async function onCatalogItemChosen(ctx: Context, catalogItemId: string): Promise<void> {
  const from = ctx.from
  if (!from) return

  const item = await getCatalogItemById(catalogItemId)
  if (!item || !item.isVisible) {
    await ctx.answerCallbackQuery({ text: "Позиция не найдена или скрыта.", show_alert: true }).catch(() => {})
    return
  }

  if (!item.serviceId || !item.service) {
    await ctx.answerCallbackQuery({
      text: "Для этой позиции запись через бота недоступна.",
      show_alert: true,
    }).catch(() => {})
    return
  }

  const session = getBookingSession(from.id)

  // Check if zone changed and duration differs (for warning)
  const prevDuration = session.durationMin
  const newDuration = item.service.durationMin
  const durationChanged = prevDuration != null && prevDuration !== newDuration

  const introText = durationChanged
    ? "Зона изменена. Выберите мастера и время заново."
    : formatCatalogIntro(item)

  await startWizardWithService(
    ctx,
    item.service.id,
    formatServiceDisplayName(item.service),
    item.service.durationMin,
    introText,
    {
      price: item.price ?? undefined,
      catalogTitle: item.titleRu,
      category: session.category ?? item.category,
    },
  )
}

// ── Re-enter category context (for "choose another service") ────────

export async function reenterCategoryContext(ctx: Context): Promise<void> {
  const from = ctx.from
  if (!from) return

  const session = getBookingSession(from.id)
  const slug = categorySlugFromSession(session)
  const wiz = session.wizardMessageId

  // Reset booking data but preserve catalog navigation context
  const preserved = {
    step: "catalog" as const,
    wizardMessageId: wiz,
    category: session.category,
    catalogGender: session.catalogGender,
  }
  clearBookingSession(from.id)
  setBookingSession(from.id, preserved)

  if (!slug) {
    await showCategorySelection(ctx)
    return
  }

  // Re-enter the first selection screen inside the current category
  await onCategoryChosen(ctx, slug)
}

// ── Electro: time-based booking services only (no informational zones) ───

/** Collect unique items from "time" group across genders. ELECTRO zones are display-only. */
function getElectroTimeItems(sections: CatalogGroupedResponse["sections"]): CatalogItemDto[] {
  const byId = new Map<string, CatalogItemDto>()
  for (const genderSections of Object.values(sections ?? {})) {
    const timeSection = genderSections?.time
    if (!timeSection?.items?.length) continue
    for (const item of timeSection.items) {
      if (item?.id && !byId.has(item.id)) byId.set(item.id, item)
    }
  }
  return Array.from(byId.values()).sort((a, b) => (a.durationMin ?? 0) - (b.durationMin ?? 0))
}

async function showElectroTimeServices(
  ctx: Context,
  telegramId: number,
  sections: CatalogGroupedResponse["sections"],
): Promise<void> {
  const timeItems = getElectroTimeItems(sections)
  const bookable = timeItems.filter((i) => i.price != null && i.durationMin != null)

  if (bookable.length === 0) {
    const keyboard = new InlineKeyboard()
    keyboard.text("📋 Консультация и подбор времени", "consult:electro").row()
    keyboard.text("◀️ Назад", "cat_back")
    await editOrSend(
      ctx,
      telegramId,
      "В категории «Электроэпиляция» пока нет пакетов времени для записи.\n\nДля консультации и подбора времени нажмите кнопку ниже.",
      keyboard,
    )
    return
  }

  const keyboard = new InlineKeyboard()
  for (const item of bookable) {
    const price = priceLabel(item.price)
    const timeLabel = item.subtitle ?? (item.durationMin != null ? `${item.durationMin} мин` : item.title)
    const label = price ? `${timeLabel} — ${price}` : timeLabel
    keyboard.text(label, `ci:${item.id}`).row()
  }
  keyboard.text("📋 Несколько зон или консультация", "consult:electro").row()
  keyboard.text("◀️ Назад", "cat_back")

  await editOrSend(
    ctx,
    telegramId,
    "Электроэпиляция\n\nЗапись производится по времени. Выберите пакет:",
    keyboard,
  )
}

export async function onElectroZoneGroupChosen(
  ctx: Context,
  groupKey: string,
): Promise<void> {
  const from = ctx.from
  if (!from) return

  setBookingSession(from.id, { catalogGroupKey: groupKey })

  let grouped: CatalogGroupedResponse
  try {
    grouped = await getCatalogGrouped("electro")
  } catch {
    await editOrSend(ctx, from.id, "Не удалось загрузить каталог. Попробуйте позже.", new InlineKeyboard())
    return
  }

  const items: CatalogItemDto[] = []
  for (const genderSections of Object.values(grouped.sections)) {
    const section = genderSections[groupKey]
    if (section) items.push(...section.items)
  }

  if (items.length === 0) {
    await editOrSend(ctx, from.id, "В этой зоне пока нет позиций.", new InlineKeyboard())
    return
  }

  const bookable = items.filter((i) => i.price != null && i.durationMin != null)
  if (bookable.length === 0) {
    await editOrSend(ctx, from.id, "Нет позиций с возможностью записи.", new InlineKeyboard().text("◀️ Назад", "cat:electro"))
    return
  }

  const keyboard = new InlineKeyboard()
  for (const item of bookable) {
    const price = priceLabel(item.price)
    const label = price ? `${item.title} — ${price}` : item.title
    keyboard.text(label, `eselzone:${item.id}`).row()
  }
  keyboard.text("◀️ Назад", "cat:electro")

  await editOrSend(ctx, from.id, `Электроэпиляция — ${groupTitle(groupKey)}\n\nВыберите область:`, keyboard)
}

export async function onElectroZoneSelected(
  ctx: Context,
  itemId: string,
): Promise<void> {
  const from = ctx.from
  if (!from) return

  const item = await getCatalogItemById(itemId)

  console.log("[ELECTRO_ZONE_SELECT]", {
    catalogItemId: itemId,
    title: item?.titleRu ?? "NOT_FOUND",
    serviceId: item?.serviceId ?? null,
    hasService: !!item?.service,
    price: item?.price ?? null,
    durationMin: item?.durationMin ?? null,
    directBooking: !!(item?.serviceId && item?.service),
  })

  if (!item || !item.isVisible) {
    await ctx.answerCallbackQuery({ text: "Позиция не найдена или скрыта.", show_alert: true }).catch(() => {})
    return
  }

  if (!item.serviceId || !item.service) {
    await ctx.answerCallbackQuery({
      text: "Для этой зоны запись через бота недоступна.",
      show_alert: true,
    }).catch(() => {})
    return
  }

  const session = getBookingSession(from.id)

  setBookingSession(from.id, { catalogElectroZone: item.titleRu })

  const introText = formatCatalogIntro(item)
  await startWizardWithService(
    ctx,
    item.service.id,
    formatServiceDisplayName(item.service),
    item.service.durationMin,
    introText,
    {
      price: item.price ?? undefined,
      catalogTitle: item.titleRu,
      category: session.category ?? item.category,
    },
  )
}

// ── Electro info section ────────────────────────────────────────────

export async function onElectroInfoChosen(ctx: Context, groupKey: string): Promise<void> {
  const from = ctx.from
  if (!from) return

  let grouped: CatalogGroupedResponse
  try {
    grouped = await getCatalogGrouped("electro")
  } catch {
    await editOrSend(ctx, from.id, "Не удалось загрузить каталог. Попробуйте позже.", new InlineKeyboard())
    return
  }

  const items: CatalogItemDto[] = []
  for (const genderSections of Object.values(grouped.sections)) {
    const section = genderSections[groupKey]
    if (section) items.push(...section.items)
  }

  const lines = ["Электроэпиляция — " + groupTitle(groupKey), ""]
  for (const item of items) {
    lines.push(`• ${item.title}`)
    if (item.subtitle) lines.push(`  ${item.subtitle}`)
    if (item.description) lines.push(`  ${item.description}`)
  }

  const keyboard = new InlineKeyboard()
  keyboard.text("◀️ Назад", "cat:electro")

  await editOrSend(ctx, from.id, lines.join("\n"), keyboard)
}

// ── Massage ─────────────────────────────────────────────────────────

async function showMassageTypes(
  ctx: Context,
  telegramId: number,
  sections: CatalogGroupedResponse["sections"],
): Promise<void> {
  const items: CatalogItemDto[] = []
  for (const genderSections of Object.values(sections)) {
    for (const section of Object.values(genderSections)) {
      items.push(...section.items)
    }
  }

  if (items.length === 0) {
    await editOrSend(ctx, telegramId, "В категории «Массаж» пока нет позиций.", new InlineKeyboard())
    return
  }

  const keyboard = new InlineKeyboard()
  for (const item of items) {
    if (item.type === "INFO") continue
    const parts = [item.title]
    if (item.durationMin) parts.push(`${item.durationMin} мин`)
    if (item.price) parts.push(`${item.price} ₽`)
    keyboard.text(parts.join(" — "), `ci:${item.id}`).row()
  }
  keyboard.text("◀️ Назад", "cat_back")

  await editOrSend(ctx, telegramId, "Массаж\n\nВыберите тип массажа:", keyboard)
}

// ── Consultation path ───────────────────────────────────────────────

export async function onConsultationChosen(ctx: Context, slug: string): Promise<void> {
  const from = ctx.from
  if (!from) return

  const label = CATEGORY_LABEL_RU[slug] ?? slug
  const keyboard = new InlineKeyboard()
  keyboard.text("◀️ Вернуться к выбору", "cat_back")

  await editOrSend(
    ctx,
    from.id,
    `${label}\n\n` +
    "Для записи на несколько зон или подбора услуги напишите в консультации.\n\n" +
    "/consult — открыть консультацию",
    keyboard,
  )
}

// ── Helpers ─────────────────────────────────────────────────────────

async function editOrSend(
  ctx: Context,
  telegramId: number,
  text: string,
  keyboard: InlineKeyboard,
): Promise<void> {
  const session = getBookingSession(telegramId)
  const w = session.wizardMessageId
  if (w) {
    try {
      await ctx.api.editMessageText(w.chatId, w.messageId, text, {
        reply_markup: keyboard,
      })
      return
    } catch {
      // fall through to send new
    }
  }
  const chatId = ctx.chat?.id ?? ctx.callbackQuery?.message?.chat?.id
  if (!chatId) return
  const sent = await ctx.api.sendMessage(chatId, text, { reply_markup: keyboard })
  setBookingSession(telegramId, {
    wizardMessageId: { chatId: sent.chat.id, messageId: sent.message_id },
  })
}
