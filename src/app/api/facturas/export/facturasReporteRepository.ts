import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { FiscalScope } from "@/lib/facturacion/reporteFiscal";
import { record } from "@/lib/facturacion/reporteFiscalCalculos";
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
  id: string; factura_id: string; ordinal?: number | null; origen?: string | null; source_id?: string | null;
  descripcion?: string | null; codigo?: string | null; cantidad?: Numeric; importe_unitario?: Numeric; subtotal?: Numeric;
  tratamiento_iva: string | null; iva_alicuota_id: number | null;
  iva_alicuota: Numeric; importe_neto: Numeric; importe_iva: Numeric; importe_total: Numeric; snapshot: unknown;
};
export type FiscalSource = {
  headers: FiscalHeader[];
  lines: FiscalLine[];
  associated: FiscalHeader[];
  productCategories?: Map<string, string[]>;
  arregloCategories?: Map<string, string>;
};
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

type CategoryRefs = {
  productIds: string[];
  sourceIds: string[];
  formConfigIds: string[];
};

function collectCategoryRefs(lines: FiscalLine[]): CategoryRefs {
  const productIds = new Set<string>();
  const sourceIds = new Set<string>();
  const formConfigIds = new Set<string>();

  const addId = (set: Set<string>, val: unknown) => {
    if (typeof val === "string" && val.length > 0) set.add(val);
  };

  const inspect = (sourceId: unknown, snapRaw: unknown) => {
    const snap = record(snapRaw);
    addId(productIds, record(snap.producto).id);
    addId(formConfigIds, snap.config_id);
    addId(sourceIds, sourceId);

    const lineaOriginal = record(snap.lineaOriginal);
    if (Object.keys(lineaOriginal).length > 0) {
      addId(productIds, record(lineaOriginal.producto).id);
      addId(formConfigIds, lineaOriginal.config_id);
      addId(sourceIds, lineaOriginal.id);
    }
  };

  for (const line of lines) {
    const snap = record(line.snapshot);
    if (Array.isArray(snap.lineasOriginales)) {
      for (const orig of snap.lineasOriginales) {
        const item = record(orig);
        inspect(item.sourceId ?? item.source_id, item.snapshot);
      }
    } else {
      inspect(line.source_id, line.snapshot);
    }
  }

  return {
    productIds: [...productIds],
    sourceIds: [...sourceIds],
    formConfigIds: [...formConfigIds],
  };
}

async function fetchInBatches<T>(
  ids: string[],
  fetcher: (batch: string[]) => Promise<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const result: T[] = [];
  for (let start = 0; start < ids.length; start += BATCH_SIZE) {
    const { data, error } = await fetcher(ids.slice(start, start + BATCH_SIZE));
    if (error) return { data: [], error };
    if (data) result.push(...data);
  }
  return { data: result, error: null };
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
            .select("id,factura_id,ordinal,origen,source_id,descripcion,codigo,cantidad,importe_unitario,subtotal,tratamiento_iva,iva_alicuota_id,iva_alicuota,importe_neto,importe_iva,importe_total,snapshot,facturas_electronicas!inner(tenant_id)")
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
      const refs = collectCategoryRefs(lines);
      const productCategories = new Map<string, string[]>();
      const sourceToCatId = new Map<string, string>();

      const [prodRes, servRes, stockRes, formRes] = await Promise.all([
        refs.productIds.length > 0
          ? fetchInBatches<{ id: string; categorias: string[] | null }>(refs.productIds, async (batch) => {
              const { data, error } = await client.from("productos").select("id,categorias").eq("tenant_id", tenantId).in("id", batch);
              return { data: data as { id: string; categorias: string[] | null }[] | null, error };
            })
          : Promise.resolve({ data: [], error: null }),
        refs.sourceIds.length > 0
          ? fetchInBatches<{ id: string; categoria_arreglo_id: string | null }>(refs.sourceIds, async (batch) => {
              const { data, error } = await client.from("detalle_arreglo").select("id,categoria_arreglo_id").eq("tenant_id", tenantId).in("id", batch);
              return { data: data as { id: string; categoria_arreglo_id: string | null }[] | null, error };
            })
          : Promise.resolve({ data: [], error: null }),
        refs.sourceIds.length > 0
          ? fetchInBatches<{ id: string; categoria_arreglo_id: string | null }>(refs.sourceIds, async (batch) => {
              const { data, error } = await client.from("operaciones_lineas").select("id,categoria_arreglo_id,operaciones!inner(tenant_id)").eq("operaciones.tenant_id", tenantId).in("id", batch);
              return { data: data as { id: string; categoria_arreglo_id: string | null }[] | null, error };
            })
          : Promise.resolve({ data: [], error: null }),
        refs.formConfigIds.length > 0
          ? fetchInBatches<{ id: string; categoria_arreglo_id: string | null }>(refs.formConfigIds, async (batch) => {
              const { data, error } = await client.from("formularios").select("id,categoria_arreglo_id").eq("tenant_id", tenantId).in("id", batch);
              return { data: data as { id: string; categoria_arreglo_id: string | null }[] | null, error };
            })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (prodRes.error) return { data: null, error: prodRes.error };
      if (servRes.error) return { data: null, error: servRes.error };
      if (stockRes.error) return { data: null, error: stockRes.error };
      if (formRes.error) return { data: null, error: formRes.error };

      for (const row of prodRes.data) {
        if (Array.isArray(row.categorias) && row.categorias.length > 0) {
          productCategories.set(row.id, row.categorias.filter((c): c is string => typeof c === "string" && c.trim().length > 0));
        }
      }
      for (const row of [...servRes.data, ...stockRes.data, ...formRes.data]) {
        if (row.categoria_arreglo_id) sourceToCatId.set(row.id, row.categoria_arreglo_id);
      }

      const arregloCategories = new Map<string, string>();
      const catIds = [...new Set(sourceToCatId.values())];
      if (catIds.length > 0) {
        const catsRes = await fetchInBatches<{ id: string; nombre: string }>(catIds, async (batch) => {
          const { data, error } = await client.from("categorias_arreglo").select("id,nombre").eq("tenant_id", tenantId).in("id", batch);
          return { data: data as { id: string; nombre: string }[] | null, error };
        });
        if (catsRes.error) return { data: null, error: catsRes.error };
        const catNames = new Map(catsRes.data.map(c => [c.id, c.nombre]));
        for (const [srcId, catId] of sourceToCatId.entries()) {
          const name = catNames.get(catId);
          if (name) arregloCategories.set(srcId, name);
        }
      }

      return { data: { headers, lines, associated, productCategories, arregloCategories }, error: null };
    } catch {
      return { data: null, error: new Error("No se pudo completar la lectura fiscal íntegra") };
    }
  },
};
