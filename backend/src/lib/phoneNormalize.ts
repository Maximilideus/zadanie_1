/**
 * Phone normalization for search/create.
 * Removes spaces, dashes, parentheses.
 * Returns empty string if input is null/undefined/empty.
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (phone == null || typeof phone !== "string") return ""
  const cleaned = phone.replace(/[\s\-()]/g, "")
  return cleaned.trim()
}
