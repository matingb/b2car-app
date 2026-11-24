import type {
  Arreglo,
  CobroArregloItem,
  FacturaElectronicaBadgeInfo,
} from "@/model/types";
import type {
  ArregloDetalleData,
  AsignacionArregloLinea,
  AsignacionArregloOperacion,
  DetalleArreglo,
  DetalleArregloFormulario,
} from "./arregloCompletoService";

export type MapArregloOptions = {
  hidePrices?: boolean;
  hideEmployeeCosts?: boolean;
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
  const subtotal = hidePrices ? 0 : r.subtotal !== undefined && r.subtotal !== null ? Number(r.subtotal) : undefined;
  const descuento = hidePrices ? 0 : r.descuento !== undefined && r.descuento !== null ? Number(r.descuento) : undefined;

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
  const pendientes = Array.isArray(r.repuestos_pendientes)
    ? (r.repuestos_pendientes as Array<Record<string, unknown>>).map((linea) => ({
        ...linea,
        ...(hidePrices
          ? { monto_unitario: 0, precio_compra: 0, precio_venta: 0, subtotal: 0, descuento: 0, total: 0 }
          : {
              monto_unitario: Number(linea.monto_unitario ?? 0),
              ...(linea.subtotal != null ? { subtotal: Number(linea.subtotal) } : {}),
              ...(linea.descuento != null ? { descuento: Number(linea.descuento) } : {}),
              ...(linea.total != null ? { total: Number(linea.total) } : {}),
              ...(linea.precio_compra != null ? { precio_compra: Number(linea.precio_compra) } : {}),
              ...(linea.precio_venta != null ? { precio_venta: Number(linea.precio_venta) } : {}),
            }),
      }))
    : undefined;

  return {
    ...rest,
    empleados,
    factura_electronica: factura as FacturaElectronicaBadgeInfo | null,
    ...(subtotal !== undefined ? { subtotal } : {}),
    ...(descuento !== undefined ? { descuento } : {}),
    precio_final: precioFinal,
    precio_sin_iva: precioSinIva,
    precios_incluyen_iva: r.precios_incluyen_iva !== false,
    tasa_iva: Number(r.tasa_iva ?? 0.21),
    ...(totalCobrado !== undefined ? { total_cobrado: totalCobrado } : {}),
    ...(saldoPendiente !== undefined ? { saldo_pendiente: saldoPendiente } : {}),
    ...(cobros !== undefined ? { cobros } : {}),
    ...(pendientes !== undefined ? { repuestos_pendientes: pendientes } : {}),
  } as Arreglo;
}

function maskDetalle(
  d: DetalleArreglo,
  hidePrices: boolean,
  hideEmployeeCosts: boolean
): DetalleArreglo {
  return {
    ...d,
    ...(hidePrices ? { precio_hora_facturada: 0, subtotal: 0, descuento: 0, total: 0 } : {}),
    ...(hideEmployeeCosts ? { valor_hora_empleado: null } : {}),
  };
}

function maskLinea(linea: AsignacionArregloLinea, hidePrices: boolean): AsignacionArregloLinea {
  if (!hidePrices) return linea;
  return {
    ...linea,
    monto_unitario: 0,
    subtotal: 0,
    descuento: 0,
    total: 0,
    producto: linea.producto
      ? {
          ...linea.producto,
          precio_unitario: 0,
          costo_unitario: 0,
        }
      : linea.producto,
  };
}

function maskAsignacion(op: AsignacionArregloOperacion, hidePrices: boolean): AsignacionArregloOperacion {
  if (!hidePrices) return op;
  return {
    ...op,
    lineas: (op.lineas ?? []).map((l) => maskLinea(l, hidePrices)),
  };
}

function maskDetalleFormulario(
  form: DetalleArregloFormulario | null,
  hidePrices: boolean
): DetalleArregloFormulario | null {
  if (!form || !hidePrices) return form;
  return {
    ...form,
    costo: 0,
    subtotal: 0,
    descuento: 0,
    total: 0,
  };
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
  const hideEmployeeCosts = options?.hideEmployeeCosts ?? false;
  const mappedArreglo = mapArreglo(data.arreglo, options);

  if (!hidePrices && !hideEmployeeCosts) {
    return {
      ...data,
      arreglo: mappedArreglo,
    };
  }

  return {
    ...data,
    arreglo: mappedArreglo,
    detalles: (data.detalles ?? []).map((d) => maskDetalle(d, hidePrices, hideEmployeeCosts)),
    asignaciones: (data.asignaciones ?? []).map((op) => maskAsignacion(op, hidePrices)),
    detalle_formulario: maskDetalleFormulario(data.detalle_formulario, hidePrices),
    ...(hidePrices ? { cobros: [] } : {}),
  };
}
