const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? "my_salon_ai_assistant_bot";

/** Deep link for price-list / catalog item: ?start=ci_<catalog_item_id> */
export function buildTelegramLink(catalogItemId) {
  return `https://t.me/${BOT_USERNAME}?start=ci_${catalogItemId}`;
}

/** Deep link for start payload: ?start=<payload> (e.g. booking, consult_zones, consult_time) */
export function buildTelegramStartLink(payload) {
  return `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(payload)}`;
}
