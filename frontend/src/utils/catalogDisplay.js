/**
 * Safe extraction of price and duration from a catalog item for public display.
 * Handles API shape (price/durationMin) and fallbacks from linked service or alternate keys.
 * Use so "—" is only shown when the value is truly absent.
 *
 * @param {object} item - Catalog item (from grouped API or similar)
 * @returns {{ price: number|null, durationMin: number|null }}
 */
export function getCatalogItemPriceAndDuration(item) {
  if (!item || typeof item !== "object") {
    return { price: null, durationMin: null };
  }
  const rawPrice = item.price ?? item.priceRub ?? item.service?.price;
  const rawDuration = item.durationMin ?? item.duration ?? item.service?.durationMin;
  const price = rawPrice != null && rawPrice !== "" ? Number(rawPrice) : null;
  const durationMin = rawDuration != null && rawDuration !== "" ? Number(rawDuration) : null;
  return {
    price: typeof price === "number" && !Number.isNaN(price) ? price : null,
    durationMin: typeof durationMin === "number" && !Number.isNaN(durationMin) ? durationMin : null,
  };
}
