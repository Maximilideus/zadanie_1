/**
 * Catalog API — fetches grouped catalog from backend.
 * Base URL: VITE_API_URL (empty = same origin).
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "";

const CATEGORIES = ["laser", "wax", "electro", "massage"];

/**
 * @param {"laser"|"wax"|"electro"|"massage"} category
 * @returns {Promise<{ category: string, sections: Record<string, Record<string, { title: string, items: Array<{ id: string, type: string, gender: string|null, groupKey: string|null, title: string, subtitle: string|null, description: string|null, price: number|null, durationMin: number|null }> }> }> }
 */
export async function fetchCatalogGrouped(category) {
  if (!CATEGORIES.includes(category)) {
    throw new Error(`Invalid category: ${category}`);
  }
  const url = `${API_BASE}/catalog/${category}/grouped`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(res.status === 400 ? text || "Invalid category" : `Catalog error: ${res.status}`);
  }
  return res.json();
}
