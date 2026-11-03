import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { FiscalScope } from "@/lib/facturacion/reporteFiscal";
import type { DocumentoFiscalClase, FacturaClase, FacturaOrigenTipo } from "@/lib/facturacion/types";

type Numeric = number | string | null;
export type FiscalHeader = {
  id: string; tenant_id: string; fecha_comprobante: string; autorizada_at: string | null; created_at: string;
  documento_tipo: DocumentoFiscalClase; clase_comprobante: FacturaClase; tipo_comprobante: number;
  punto_venta: number | null; numero_comprobante: number | null; cae: string | null; cae_vencimiento: string | null;
  emisor_snapshot: unknown; receptor_snapshot: unknown; moneda: string;
  origen_tipo: FacturaOrigenTipo; arreglo_id: string | null; operacion_id: string | null; documento_asociado_id: string | null;
  importe_neto_gravado: Numeric; importe_exento: Numeric; importe_no_gravado: Numeric;
  importe_iva: Numeric; importe_tributos: Numeric; otros_impuestos_nacionales: Numeric; total: Numeric;
};
export type FiscalLine = {
  id: string; factura_id: string; tratamiento_iva: string | null; iva_alicuota_id: number | null;
  iva_alicuota: Numeric; importe_neto: Numeric; importe_iva: Numeric; importe_total: Numeric; snapshot: unknown;
};
export type FiscalSource = { headers: FiscalHeader[]; lines: FiscalLine[]; associated: FiscalHeader[] };
type ReadResult = { data: FiscalSource; error: null } | { data: null; error: PostgrestError | Error };
export interface FacturasReporteRepository {
  read(client: SupabaseClient, tenantId: string, filters: FiscalScope, corte: string): Promise<ReadResult>;
}

const HEADER_COLUMNS = "id,tenant_id,fecha_comprobante,autorizada_at,created_at,documento_tipo,clase_comprobante,tipo_comprobante,punto_venta,numero_comprobante,cae,cae_vencimiento,emisor_snapshot,receptor_snapshot,moneda,origen_tipo,arreglo_id,operacion_id,documento_asociado_id,importe_neto_gravado,importe_exento,importe_no_gravado,importe_iva,importe_tributos,otros_impuestos_nacionales,total";
const PAGE_SIZE = 500;
const BATCH_SIZE = 100;

function appendUnique<T extends { id: string }>(target: T[], page: T[], seen: Set<string>) {
  for (const row of page) {
    if (!row.id || seen.has(row.id)) throw new Error("Lectura fiscal con IDs duplicados o ausentes");
    seen.add(row.id); target.push(row);
  }
}

/**
 * Immutable authorized headers: ascending (calendar date, UUID), authorization <= corte.
 * Legacy null autorizada_at uses created_at <= corte (the service warns about this).
 * Lines and associated headers: ascending UUID in batches of 100 parent IDs, with RLS
 * plus explicit tenant predicates, including the inner parent join for lines.
 * Every traversal ends ONLY on an empty page, even if the server caps pages below 500.
 * Errors/duplicate IDs abort the entire result; no count, offsets or partial success.
 */
export const facturasReporteRepository: FacturasReporteRepository = {
  async read(client, tenantId, filters, corte) {
    try {
      const headers: FiscalHeader[] = [];
      const seen = new Set<string>();
      let cursor: FiscalHeader | undefined;
      for (;;) {
        let query = client.from("facturas_electronicas").select(HEADER_COLUMNS)
          .eq("tenant_id", tenantId).eq("estado", "AUTORIZADA").eq("ambiente", filters.ambiente)
          .in("origen_tipo", ["ARREGLO", "VENTA"])
          .in("documento_tipo", ["FACTURA", "NOTA_CREDITO", "NOTA_DEBITO"])
          .gte("fecha_comprobante", filters.desde).lte("fecha_comprobante", filters.hasta)
          .or(`autorizada_at.lte.${corte},and(autorizada_at.is.null,created_at.lte.${corte})`)
          .order("fecha_comprobante", { ascending: true }).order("id", { ascending: true }).limit(PAGE_SIZE);
        if (filters.documentoTipo) query = query.eq("documento_tipo", filters.documentoTipo);
        if (filters.origenTipo) query = query.eq("origen_tipo", filters.origenTipo);
        if (filters.cuitEmisor) query = query.eq("emisor_snapshot->>cuit", filters.cuitEmisor);
        if (cursor) query = query.or(`fecha_comprobante.gt.${cursor.fecha_comprobante},and(fecha_comprobante.eq.${cursor.fecha_comprobante},id.gt.${cursor.id})`);
        const { data, error } = await query;
        if (error) return { data: null, error };
        const page = (data ?? []) as unknown as FiscalHeader[];
        if (!page.length) break;
        appendUnique(headers, page, seen);
        cursor = page[page.length - 1];
      }
      const lines: FiscalLine[] = [];
      const lineIds = new Set<string>();
      const associated: FiscalHeader[] = [];
      const associatedIds = new Set(headers.map(h => h.documento_asociado_id).filter((id): id is string => Boolean(id)));
      const ids = headers.map(h => h.id);
      for (let start = 0; start < ids.length; start += BATCH_SIZE) {
        const batch = ids.slice(start, start + BATCH_SIZE);
        let lastId: string | undefined;
        for (;;) {
          let query = client.from("facturas_electronicas_lineas")
            .select("id,factura_id,tratamiento_iva,iva_alicuota_id,iva_alicuota,importe_neto,importe_iva,importe_total,snapshot,facturas_electronicas!inner(tenant_id)")
            .eq("facturas_electronicas.tenant_id", tenantId).in("factura_id", batch)
            .order("id", { ascending: true }).limit(PAGE_SIZE);
          if (lastId) query = query.gt("id", lastId);
          const { data, error } = await query;
          if (error) return { data: null, error };
          const page = (data ?? []) as unknown as FiscalLine[];
          if (!page.length) break;
          appendUnique(lines, page, lineIds);
          lastId = page[page.length - 1].id;
        }
      }
      const references = Array.from(associatedIds);
      const seenAssociated = new Set<string>();
      for (let start = 0; start < references.length; start += BATCH_SIZE) {
        let lastId: string | undefined;
        for (;;) {
          let query = client.from("facturas_electronicas").select(HEADER_COLUMNS)
            .eq("tenant_id", tenantId).in("id", references.slice(start, start + BATCH_SIZE))
            .order("id", { ascending: true }).limit(PAGE_SIZE);
          if (lastId) query = query.gt("id", lastId);
          const { data, error } = await query;
          if (error) return { data: null, error };
          const page = (data ?? []) as unknown as FiscalHeader[];
          if (!page.length) break;
          appendUnique(associated, page, seenAssociated);
          lastId = page[page.length - 1].id;
        }
      }
      return { data: { headers, lines, associated }, error: null };
    } catch {
      return { data: null, error: new Error("No se pudo completar la lectura fiscal íntegra") };
    }
  },
};
