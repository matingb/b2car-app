/**
 * Returns the initials for a display name.
 *
 * - Single word  → first two characters (e.g. "Matias" → "MA")
 * - Multiple words → first letter of first and last words (e.g. "Matias Gonzalez" → "MG")
 * - Empty / undefined → "?"
 */
export function getInitials(name?: string | null): string {
  if (!name) return "?";

  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  const first = parts[0][0] ?? "";
  const last = parts[parts.length - 1][0] ?? "";
  return (first + last).toUpperCase();
}
