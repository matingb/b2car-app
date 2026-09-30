export const ARREGLO_DESCRIPCION_FALLBACK = "Arreglo registrado sin detalle específico";

type ArregloDescripcionDetalle = {
  descripcion?: unknown;
};

export function buildArregloDescripcion({
  detalles,
  detalleFormulario,
  fallback = ARREGLO_DESCRIPCION_FALLBACK,
}: {
  detalles?: ArregloDescripcionDetalle[] | null;
  detalleFormulario?: unknown;
  fallback?: string;
}): string {
  const detallesNormalizados = (detalles ?? [])
    .map((detalle) => String(detalle?.descripcion ?? "").trim())
    .filter(Boolean);
  const hasDetalleFormulario = Array.isArray(detalleFormulario)
    ? detalleFormulario.length > 0
    : Boolean(detalleFormulario);

  if (hasDetalleFormulario && detallesNormalizados.length > 0) {
    return detallesNormalizados.join(" | ");
  }

  if (detallesNormalizados.length > 0) {
    return detallesNormalizados.join(" | ");
  }

  return fallback;
}

/**
 * Formatea el número secuencial de orden de un arreglo con ceros a la izquierda (ej: #000001).
 * Por defecto usa 6 dígitos de ancho (ej: 1 -> #000001, 42 -> #000042).
 */
export function formatArregloNumero(numeroOrden?: number | null, padding = 6): string {
  if (numeroOrden == null || !Number.isFinite(numeroOrden) || numeroOrden <= 0) return "";
  return `#${String(numeroOrden).padStart(padding, "0")}`;
}

/**
 * Concatena el número autoincremental de orden a la descripción del arreglo para su visualización en el frontend.
 * Ejemplos:
 *  - numero_orden: 1, descripcion: "Cambio de aceite" -> "#000001 - Cambio de aceite"
 *  - numero_orden: 1, descripcion: "" -> "#000001"
 *  - numero_orden: null, descripcion: "Cambio de aceite" -> "Cambio de aceite"
 *  - numero_orden: null, descripcion: "" -> fallback ("Arreglo sin descripción")
 */
export function formatArregloTitulo(
  arreglo?: { numero_orden?: number | null; descripcion?: string | null } | null,
  fallback = "Arreglo sin descripción",
  padding = 6
): string {
  if (!arreglo) return fallback;
  const num = formatArregloNumero(arreglo.numero_orden, padding);
  const desc = String(arreglo.descripcion ?? "").trim();

  if (num && desc) {
    if (desc.startsWith(num)) return desc;
    return `${num} - ${desc}`;
  }
  if (num) return num;
  return desc || fallback;
}



