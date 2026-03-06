const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? "my_salon_ai_assistant_bot";

export function buildTelegramLink(catalogItemId) {
  return `https://t.me/${BOT_USERNAME}?start=ci_${catalogItemId}`;
}
