/**
 * Public API for unauthenticated pages (e.g. homepage).
 * Base URL: VITE_API_URL (empty = same origin).
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "";

/**
 * @returns {Promise<Array<{ id: string, name: string, photoUrl: string|null, publicTitleRu: string|null }>>}
 */
export async function getPublicMasters() {
  const res = await fetch(`${API_BASE}/public/masters`);
  if (!res.ok) throw new Error("Не удалось загрузить специалистов");
  const data = await res.json();
  return data.masters ?? [];
}
