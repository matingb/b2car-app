import { parseCalendarDate } from "@/lib/fechas";
import type { CondicionIvaProveedor, FacturaRecibidaClase, PercepcionCodigo } from "./types";
import type { FiscalRow, FiscalMoneyKey } from "@/lib/facturacion/reporteFiscal";

export type ComprasFiscalFilters = {
  format: "csv" | "xlsx";
  desde: string;
  hasta: string;
  tipoOperacion?: "COMPRA" | "GASTO";
  cuitEmisor?: string;
};

export class ComprasFiscalQueryError extends Error {}

export function parseComprasFiscalFilters(params: URLSearchParams): ComprasFiscalFilters {
  const allowed = new Set(["format", "desde", "hasta", "tipoOperacion", "cuitEmisor"]);
  for (const key of params.keys()) {
    if (!allowed.has(key)) throw new ComprasFiscalQueryError(`Filtro incompatible con el reporte de compras: ${key}`);
    if (params.getAll(key).length !== 1) throw new ComprasFiscalQueryError(`Filtro repetido: ${key}`);
  }

  const format = params.get("format");
  if (format !== "csv" && format !== "xlsx") throw new ComprasFiscalQueryError("Formato requerido: csv o xlsx");
  const desde = params.get("desde") ?? "";
  const hasta = params.get("hasta") ?? "";
  if (!parseCalendarDate(desde) || !parseCalendarDate(hasta)) throw new ComprasFiscalQueryError("Desde y hasta deben ser fechas válidas (AAAA-MM-DD)");
  if (desde > hasta) throw new ComprasFiscalQueryError("La fecha desde debe ser anterior o igual a la fecha hasta");

  const tipoOperacion = params.get("tipoOperacion") || undefined;
  const cuitEmisor = params.get("cuitEmisor") || undefined;
  if (tipoOperacion && tipoOperacion !== "COMPRA" && tipoOperacion !== "GASTO") {
    throw new ComprasFiscalQueryError("Tipo de operación desconocido");
  }
  if (cuitEmisor && !/^\d{11}$/.test(cuitEmisor)) throw new ComprasFiscalQueryError("El CUIT del emisor debe contener 11 dígitos");

  return {
    format,
    desde,
    hasta,
    tipoOperacion: tipoOperacion as ComprasFiscalFilters["tipoOperacion"],
    cuitEmisor,
  };
}

export function comprasFiscalFilename(filters: ComprasFiscalFilters) {
  return `reporte-fiscal-compras-${filters.desde}_${filters.hasta}.${filters.format}`;
}

export type ComprasFiscalLinea = {
  id: string;
  orden: number;
  tipo: "CONCEPTO" | "PERCEPCION";
  descripcion: string;
  percepcionCodigo: PercepcionCodigo | null;
  importe: number | string;
  ivaAlicuotaId?: number | null;
};

export type ComprasFiscalDesgloseIva = {
  ivaAlicuotaId: number;
  base: number | string;
  iva: number | string;
};

export type ComprasFiscalDocumento = {
  id: string;
  operacionId: string;
  operacionTipo: "COMPRA" | "GASTO";
  tipoDocumento: "FACTURA" | "RETENCION";
  clase: FacturaRecibidaClase | null;
  numero: string | null;
  fecha: string;
  emisor: {
    razonSocial: string;
    cuit: string | null;
    condicionIva: CondicionIvaProveedor | null;
  };
  receptor: {
    razonSocial: string | null;
    cuit: string | null;
    condicionIva: CondicionIvaProveedor | null;
  };
  codigoAutorizacion: string | null;
  vencimientoAutorizacion: string | null;
  observaciones: string | null;
  desgloseIva: ComprasFiscalDesgloseIva[] | null;
  /** IVA contenido informado en una factura B; se muestra como nota, nunca como IVA discriminado. */
  ivaContenido?: number | string | null;
  lineas: ComprasFiscalLinea[];
  updatedAt: string;
};

export type ComprasFiscalPercepcionColumna = {
  key: string;
  label: string;
  header: string;
};

export type ComprasFiscalFilaFactura = FiscalRow & {
  documentoId: string;
  operacionId: string;
  conceptoGasto: string;
  percepcionIva: number;
  percepcionIibb: number;
  percepciones: Record<string, number>;
};

export type ComprasFiscalFilaRetencion = {
  fecha: string;
  numero: string;
  emisor: string;
  cuitEmisor: string;
  descripcion: string;
  importe: number;
  documentoId: string;
  operacionId: string;
};

export type ComprasFiscalReport = {
  filters: ComprasFiscalFilters;
  rows: ComprasFiscalFilaFactura[];
  columnasPercepciones: ComprasFiscalPercepcionColumna[];
  retenciones: ComprasFiscalFilaRetencion[];
  summary: {
    facturas: number;
    totalFacturado: number;
    retenciones: number;
    totalRetenciones: number;
    totalPercepciones: number;
    desgloseIncompleto: number;
    fiscalAmounts: Record<FiscalMoneyKey, number | null>;
    missingFiscalAmounts: Record<FiscalMoneyKey, number>;
    percepciones: Record<string, number>;
  };
};

