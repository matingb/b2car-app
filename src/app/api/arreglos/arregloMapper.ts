import type {
  Arreglo,
  CobroArregloItem,
  FacturaElectronicaBadgeInfo,
} from "@/model/types";
import type { ArregloDetalleData } from "./arregloCompletoService";

export type MapArregloOptions = {
  hidePrices?: boolean;
};

/**
 * Mapea una fila o payload crudo de arreglo al tipo Arreglo del dominio.
 * Centraliza la extracción de facturas electrónicas, empleados y la redacción de precios si corresponde.
 */
export function mapArreglo(
  raw: unknown,
  options?: MapArregloOptions
): Arreglo {
  if (!raw || typeof raw !== "object") {
    return raw as Arreglo;
  }

  const r = raw as Record<string, unknown>;
  const { empleados_detallados, facturas_electronicas, ...rest } = r;

  const facturas = Array.isArray(facturas_electronicas)
    ? (facturas_electronicas as Array<Record<string, unknown>>)
    : [];
  const factura =
    facturas.find((f) => f?.estado === "AUTORIZADA") ||
    facturas[0] ||
    (r.factura_electronica as FacturaElectronicaBadgeInfo | null) ||
    null;

  const empleados =
    (empleados_detallados as Array<{ id: string; nombre: string; apellido?: string }>) ||
    (r.empleados as Array<{ id: string; nombre: string; apellido?: string }>) ||
    [];

  const hidePrices = options?.hidePrices ?? false;

  const precioFinal = hidePrices ? 0 : Number(r.precio_final ?? 0);
  const precioSinIva = hidePrices ? 0 : Number(r.precio_sin_iva ?? 0);

  const hasTotalCobrado = r.total_cobrado !== undefined && r.total_cobrado !== null;
  const totalCobrado = hidePrices
    ? 0
    : hasTotalCobrado
      ? Number(r.total_cobrado)
      : undefined;

  const hasSaldoPendiente = r.saldo_pendiente !== undefined && r.saldo_pendiente !== null;
  const saldoPendiente = hidePrices
    ? 0
    : hasSaldoPendiente
      ? Number(r.saldo_pendiente)
      : r.precio_final !== undefined
        ? Math.max(0, Number(r.precio_final ?? 0) - Number(r.total_cobrado ?? 0))
        : undefined;

  const cobros = hidePrices ? [] : (r.cobros as CobroArregloItem[] | undefined);

  return {
    ...rest,
    empleados,
    factura_electronica: factura as FacturaElectronicaBadgeInfo | null,
    precio_final: precioFinal,
    precio_sin_iva: precioSinIva,
    ...(totalCobrado !== undefined ? { total_cobrado: totalCobrado } : {}),
    ...(saldoPendiente !== undefined ? { saldo_pendiente: saldoPendiente } : {}),
    ...(cobros !== undefined ? { cobros } : {}),
  } as Arreglo;
}

/**
 * Mapea los detalles completos de un arreglo (servicios, repuestos, formularios, cobros)
 * redactando precios y costos si el usuario no tiene permisos para visualizarlos.
 */
export function mapArregloDetalleCompleto(
  data: ArregloDetalleData,
  options?: MapArregloOptions
): ArregloDetalleData {
  if (!data) return data;

  const hidePrices = options?.hidePrices ?? false;
  const mappedArreglo = mapArreglo(data.arreglo, options);

  if (!hidePrices) {
    return {
      ...data,
      arreglo: mappedArreglo,
    };
  }

  const detalles = (data.detalles ?? []).map((d) => ({
    ...d,
    valor: 0,
  }));

  const asignaciones = (data.asignaciones ?? []).map((op) => ({
    ...op,
    lineas: (op.lineas ?? []).map((l) => ({
      ...l,
      monto_unitario: 0,
      producto: l.producto
        ? {
            ...l.producto,
            precio_unitario: 0,
            costo_unitario: 0,
          }
        : l.producto,
    })),
  }));

  const detalleFormulario = data.detalle_formulario
    ? {
        ...data.detalle_formulario,
        costo: 0,
      }
    : null;

  return {
    ...data,
    arreglo: mappedArreglo,
    detalles,
    asignaciones,
    detalle_formulario: detalleFormulario,
    cobros: [],
  };
}
