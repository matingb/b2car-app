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
