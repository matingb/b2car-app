import type { FacturaElectronicaResumen } from "@/lib/facturacion/types";
import type { RemitoResumen } from "@/lib/remitos/types";

/** Filtro de tipo del listado unificado. Vacío = todos los documentos. */
export type DocumentoTipoFiltro = "" | "FACTURA" | "NOTA_CREDITO" | "NOTA_DEBITO" | "REMITO";

/**
 * Ítem del listado de Documentación: un comprobante fiscal (factura o nota) o un remito.
 * Los remitos conservan su resumen sin importes.
 */
export type DocumentoListado =
  | { tipo: "FISCAL"; id: string; fecha: string; factura: FacturaElectronicaResumen }
  | { tipo: "REMITO"; id: string; fecha: string; remito: RemitoResumen };

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
 * El listado combina dos fuentes y cada página requiere leer los documentos previos de ambas.
 */
export const DOCUMENTOS_MAX_RESULTADOS = 1000;
