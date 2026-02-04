/**
 * Construye la descripción de un arreglo a partir de sus detalles (servicios).
 * Si no hay detalles con descripción, usa el fallback (ej. columna descripcion del arreglo).
 */
export function buildDescripcionFromDetalles(
  detalles: Array<{ descripcion?: unknown }> | null | undefined,
  fallback: string
): string {
  const concatenada = (detalles ?? [])
    .map((d) => String(d?.descripcion ?? "").trim())
    .filter(Boolean)
    .join(" | ");
  return concatenada || fallback;
}
