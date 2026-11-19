import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  ComprasFiscalDocumento,
  ComprasFiscalFilters,
  ComprasFiscalLinea,
} from "@/lib/comprobantesRecibidos/reporteFiscal";

type DatabaseLinea = {
  id: string;
  orden: number;
  tipo: string;
  descripcion: string;
  percepcion_codigo: string | null;
  importe: number | string;
  iva_alicuota_id: number | null;
};

type DatabaseDocumento = {
  id: string;
  tenant_id: string;
  operacion_id: string;
  tipo_documento: string;
  clase: string | null;
  numero: string | null;
  fecha: string;
  emisor_razon_social: string;
  emisor_cuit: string | null;
  emisor_condicion_iva: string | null;
  receptor_razon_social: string | null;
  receptor_cuit: string | null;
  receptor_condicion_iva: string | null;
  codigo_autorizacion: string | null;
  vencimiento_autorizacion: string | null;
  observaciones: string | null;
  desglose_iva: Array<{ iva_alicuota_id: number; base: number | string; iva: number | string }> | null;
  updated_at: string;
  operaciones?: { tipo: string | null; tenant_id: string } | { tipo: string | null; tenant_id: string }[] | null;
  comprobantes_recibidos_lineas?: DatabaseLinea[] | null;
};

type VersionRow = {
  id: string;
  fecha: string;
  updated_at: string;
  operaciones?: { tipo: string | null; tenant_id: string } | { tipo: string | null; tenant_id: string }[] | null;
};
type RepositoryResult = { data: ComprasFiscalDocumento[]; error: null } | { data: null; error: PostgrestError | Error };

export interface ComprobantesReporteRepository {
  read(client: SupabaseClient, tenantId: string, filters: ComprasFiscalFilters): Promise<RepositoryResult>;
}

const PAGE_SIZE = 500;
const DOCUMENT_COLUMNS = [
  "id", "tenant_id", "operacion_id", "tipo_documento", "clase", "numero", "fecha",
  "emisor_razon_social", "emisor_cuit", "emisor_condicion_iva",
  "receptor_razon_social", "receptor_cuit", "receptor_condicion_iva",
  "codigo_autorizacion", "vencimiento_autorizacion", "observaciones", "desglose_iva", "updated_at",
  "operaciones!inner(tipo,tenant_id)",
  "comprobantes_recibidos_lineas(id,orden,tipo,descripcion,percepcion_codigo,importe,iva_alicuota_id)",
].join(",");

function operationOf(row: DatabaseDocumento) {
  return Array.isArray(row.operaciones) ? row.operaciones[0] : row.operaciones;
}

function appendUnique<T extends { id: string }>(target: T[], page: T[], seen: Set<string>, description: string) {
  for (const row of page) {
    if (!row.id || seen.has(row.id)) throw new Error(`Lectura fiscal con ${description} duplicados o ausentes`);
    seen.add(row.id);
    target.push(row);
  }
}

async function readDocuments(client: SupabaseClient, tenantId: string, filters: ComprasFiscalFilters) {
  const documents: DatabaseDocumento[] = [];
  const seen = new Set<string>();
  let cursor: { fecha: string; id: string } | null = null;
  while (true) {
    let query = client.from("comprobantes_recibidos").select(DOCUMENT_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("operaciones.tenant_id", tenantId)
      .gte("fecha", filters.desde)
      .lte("fecha", filters.hasta)
      .order("fecha", { ascending: true })
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);
    if (filters.tipoOperacion) query = query.eq("operaciones.tipo", filters.tipoOperacion);
    if (filters.cuitEmisor) query = query.eq("emisor_cuit_normalizado", filters.cuitEmisor);
    if (cursor) query = query.or(`fecha.gt.${cursor.fecha},and(fecha.eq.${cursor.fecha},id.gt.${cursor.id})`);

    const { data, error } = await query;
    if (error) throw error;
    const page = (data ?? []) as unknown as DatabaseDocumento[];
    appendUnique(documents, page, seen, "documentos");
    if (page.length < PAGE_SIZE) break;
    const last = page[page.length - 1];
    cursor = { fecha: last.fecha, id: last.id };
  }
  return documents;
}

async function readVersions(client: SupabaseClient, tenantId: string, filters: ComprasFiscalFilters) {
  const versions: VersionRow[] = [];
  const seen = new Set<string>();
  let cursor: { fecha: string; id: string } | null = null;
  while (true) {
    let query = client.from("comprobantes_recibidos")
      .select("id,fecha,updated_at,operaciones!inner(tipo,tenant_id)")
      .eq("tenant_id", tenantId)
      .eq("operaciones.tenant_id", tenantId)
      .gte("fecha", filters.desde)
      .lte("fecha", filters.hasta)
      .order("fecha", { ascending: true })
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);
    if (filters.tipoOperacion) query = query.eq("operaciones.tipo", filters.tipoOperacion);
    if (filters.cuitEmisor) query = query.eq("emisor_cuit_normalizado", filters.cuitEmisor);
    if (cursor) query = query.or(`fecha.gt.${cursor.fecha},and(fecha.eq.${cursor.fecha},id.gt.${cursor.id})`);

    const { data, error } = await query;
    if (error) throw error;
    const page = (data ?? []) as unknown as VersionRow[];
    appendUnique(versions, page, seen, "versiones de documentos");
    if (page.length < PAGE_SIZE) break;
    const last = page[page.length - 1];
    cursor = { fecha: last.fecha, id: last.id };
  }
  return versions;
}

function assertStableRead(documents: DatabaseDocumento[], versions: VersionRow[]) {
  if (documents.length !== versions.length) throw new Error("Los documentos cambiaron durante la lectura del reporte");
  const versionsById = new Map(versions.map((row) => [row.id, row]));
  for (const document of documents) {
    const version = versionsById.get(document.id);
    const documentOperation = operationOf(document);
    const currentOperation = version
      ? Array.isArray(version.operaciones) ? version.operaciones[0] : version.operaciones
      : null;
    if (!version
      || version.fecha !== document.fecha
      || version.updated_at !== document.updated_at
      || documentOperation?.tipo !== currentOperation?.tipo
      || documentOperation?.tenant_id !== currentOperation?.tenant_id) {
      throw new Error("Los documentos cambiaron durante la lectura del reporte");
    }
  }
}

function mapDocument(row: DatabaseDocumento, tenantId: string): ComprasFiscalDocumento {
  const operation = operationOf(row);
  if (!operation || row.tenant_id !== tenantId || operation.tenant_id !== tenantId) throw new Error("Documento fuera del tenant solicitado");
  if (operation.tipo !== "COMPRA" && operation.tipo !== "GASTO") throw new Error("Documento asociado a una operación no admitida");
  if (row.tipo_documento !== "FACTURA" && row.tipo_documento !== "RETENCION") throw new Error("Tipo de documento recibido desconocido");
  if (row.tipo_documento === "FACTURA" && row.clase !== "A" && row.clase !== "B" && row.clase !== "C") throw new Error("Factura recibida sin clase válida");

  const lineas: ComprasFiscalLinea[] = [...(row.comprobantes_recibidos_lineas ?? [])]
    .sort((a, b) => a.orden - b.orden)
    .map((line) => {
      if (line.tipo !== "PERCEPCION" && line.tipo !== "CONCEPTO") throw new Error("Tipo de línea recibida desconocido");
      return {
        id: line.id,
        orden: line.orden,
        tipo: line.tipo,
        descripcion: line.descripcion,
        percepcionCodigo: line.percepcion_codigo as ComprasFiscalLinea["percepcionCodigo"],
        importe: line.importe,
        ivaAlicuotaId: line.iva_alicuota_id,
      };
    });
  const desgloseIva = row.desglose_iva?.map((item) => ({
    ivaAlicuotaId: item.iva_alicuota_id,
    base: item.base,
    iva: item.iva,
  })) ?? null;

  return {
    id: row.id,
    operacionId: row.operacion_id,
    operacionTipo: operation.tipo,
    tipoDocumento: row.tipo_documento,
    clase: row.clase as ComprasFiscalDocumento["clase"],
    numero: row.numero,
    fecha: row.fecha,
    emisor: {
      razonSocial: row.emisor_razon_social,
      cuit: row.emisor_cuit,
      condicionIva: row.emisor_condicion_iva as ComprasFiscalDocumento["emisor"]["condicionIva"],
    },
    receptor: {
      razonSocial: row.receptor_razon_social,
      cuit: row.receptor_cuit,
      condicionIva: row.receptor_condicion_iva as ComprasFiscalDocumento["receptor"]["condicionIva"],
    },
    codigoAutorizacion: row.codigo_autorizacion,
    vencimientoAutorizacion: row.vencimiento_autorizacion,
    observaciones: row.observaciones,
    desgloseIva,
    lineas,
    updatedAt: row.updated_at,
  };
}

export const comprobantesReporteRepository: ComprobantesReporteRepository = {
  async read(client, tenantId, filters) {
    try {
      const rows = await readDocuments(client, tenantId, filters);
      const versions = await readVersions(client, tenantId, filters);
      assertStableRead(rows, versions);
      const seenLines = new Set<string>();
      for (const row of rows) appendUnique([], row.comprobantes_recibidos_lineas ?? [], seenLines, "líneas");
      return { data: rows.map((row) => mapDocument(row, tenantId)), error: null };
    } catch (error) {
      return { data: null, error: error as PostgrestError | Error };
    }
  },
};
