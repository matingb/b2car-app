import type { FacturaElectronicaResumen } from "@/lib/facturacion/types";
import type { RemitoResumen } from "@/lib/remitos/types";
import type { ComprobanteRecibidoResumen } from "@/lib/comprobantesRecibidos/types";

/**
 * Filtro de tipo del listado unificado. Vacío = todos los documentos.
 * RECIBIDO = facturas y retenciones de proveedores cargadas en compras y gastos.
 */
export type DocumentoTipoFiltro = "" | "FACTURA" | "NOTA_CREDITO" | "NOTA_DEBITO" | "REMITO" | "RECIBIDO";

/**
 * Ítem del listado de Documentación: un comprobante fiscal emitido (factura o nota), un remito o
 * un documento recibido (factura de compra/gasto o retención, cargado manualmente).
 * Los remitos conservan su resumen sin importes.
 */
export type DocumentoListado =
  | { tipo: "FISCAL"; id: string; fecha: string; factura: FacturaElectronicaResumen }
  | { tipo: "REMITO"; id: string; fecha: string; remito: RemitoResumen }
  | { tipo: "RECIBIDO"; id: string; fecha: string; comprobante: ComprobanteRecibidoResumen };

/** Origen comercial de los documentos asociados: un arreglo o una operación de venta. */
export type DocumentosOrigen = { tipo: "ARREGLO" | "VENTA"; id: string };

export type DocumentosPaginados = {
  items: DocumentoListado[];
  page: number;
  pageSize: number;
  total: number;
};

export type DocumentosFiltros = {
  page?: number;
  pageSize?: number;
  tipo?: string | null;
  estado?: string | null;
  ambiente?: string | null;
  desde?: string | null;
  hasta?: string | null;
  search?: string | null;
  /** Solo remitos. */
  clase?: string | null;
  /** Solo remitos: `con` o `sin` factura asociada. */
  factura?: string | null;
};

/**
 * Cantidad máxima de documentos navegables con paginación en el listado unificado.
 * El listado combina varias fuentes y cada página requiere leer los documentos previos de todas.
 */
export const DOCUMENTOS_MAX_RESULTADOS = 1000;
