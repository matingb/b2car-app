export const ARREGLO_DESCRIPCION_FALLBACK = "Arreglo registrado sin detalle específico";

type ArregloDescripcionDetalle = {
  descripcion?: unknown;
};

export function buildArregloDescripcion({
  tipo,
  detalles,
  detalleFormulario,
  fallback = ARREGLO_DESCRIPCION_FALLBACK,
}: {
  tipo?: unknown;
  detalles?: ArregloDescripcionDetalle[] | null;
  detalleFormulario?: unknown;
  fallback?: string;
}): string {
  const tipoNormalizado = String(tipo ?? "").trim();
  const detallesNormalizados = (detalles ?? [])
    .map((detalle) => String(detalle?.descripcion ?? "").trim())
    .filter(Boolean);
  const hasDetalleFormulario = Array.isArray(detalleFormulario)
    ? detalleFormulario.length > 0
    : Boolean(detalleFormulario);

  if (tipoNormalizado && hasDetalleFormulario && detallesNormalizados.length > 0) {
    return [tipoNormalizado, ...detallesNormalizados].join(" | ");
  }

  if (detallesNormalizados.length > 0) {
    return detallesNormalizados.join(" | ");
  }
  
  if (tipoNormalizado) {
    return tipoNormalizado;
  }

  return fallback;
}
