import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/app/api/apiError";
import {
  FACTURA_RESUMEN_COLUMNS,
  facturaSearchConditions,
  mapSummary,
} from "@/lib/facturacion/facturacionService";
import { parseCalendarDate } from "@/lib/fechas";
import { REMITO_RESUMEN_COLUMNS, mapResumen, remitoSearchConditions } from "@/lib/remitos/remitosService";
import {
  DOCUMENTOS_MAX_RESULTADOS,
  type DocumentoListado,
  type DocumentosFiltros,
  type DocumentosPaginados,
} from "./types";

/*
 * Listado unificado de Documentación: comprobantes fiscales y remitos ordenados por fecha.
 * Es de solo lectura y combina ambas tablas sin cambios en la base: para la página N se leen
 * los primeros N * tamaño de cada fuente con el mismo orden, se intercalan y se recorta la página.
 */

const TIPOS = new Set(["", "FACTURA", "NOTA_CREDITO", "NOTA_DEBITO", "REMITO"]);
const ESTADOS = new Set(["BORRADOR", "LISTA", "ENVIANDO", "AUTORIZADA", "RECHAZADA", "INCIERTA"]);

type Entrada = { fecha: string; createdAt: number; item: DocumentoListado };

function number(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function timestamp(value: unknown): number {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function validar(filtros: DocumentosFiltros) {
  const tipo = filtros.tipo ?? "";
  if (!TIPOS.has(tipo)) throw new ApiError(400, "El tipo de documento del filtro no es válido", "VALIDATION");
  if (filtros.estado && !ESTADOS.has(filtros.estado)) {
    throw new ApiError(400, "El estado del filtro no es válido", "VALIDATION");
  }
  if (filtros.ambiente && filtros.ambiente !== "HOMOLOGACION" && filtros.ambiente !== "PRODUCCION") {
    throw new ApiError(400, "El ambiente del filtro no es válido", "VALIDATION");
  }
  if (filtros.clase && filtros.clase !== "R" && filtros.clase !== "X") {
    throw new ApiError(400, "El tipo de remito del filtro no es válido", "VALIDATION");
  }
  if (filtros.factura && filtros.factura !== "con" && filtros.factura !== "sin") {
    throw new ApiError(400, "El filtro de factura no es válido", "VALIDATION");
  }
  if ((filtros.desde && !parseCalendarDate(filtros.desde)) || (filtros.hasta && !parseCalendarDate(filtros.hasta))) {
    throw new ApiError(400, "Las fechas del filtro deben tener formato AAAA-MM-DD", "VALIDATION");
  }
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    throw new ApiError(400, "La fecha desde no puede ser posterior a la fecha hasta", "VALIDATION");
  }
  const search = (filtros.search ?? "").replace(/[%_,()]/g, "").trim();
  if (search.length > 100) throw new ApiError(400, "La búsqueda no puede superar los 100 caracteres", "VALIDATION");
  return { tipo, search };
}

export async function listDocumentos(
  supabase: SupabaseClient,
  tenantId: string,
  filtros: DocumentosFiltros = {},
): Promise<DocumentosPaginados> {
  const { tipo, search } = validar(filtros);
  const page = Math.max(1, Math.trunc(number(filtros.page, 1)));
  const pageSize = Math.min(100, Math.max(10, Math.trunc(number(filtros.pageSize, 25))));
  const necesarios = page * pageSize;
  if (necesarios > DOCUMENTOS_MAX_RESULTADOS) {
    throw new ApiError(
      400,
      `El listado muestra hasta ${DOCUMENTOS_MAX_RESULTADOS} documentos. Acotá la búsqueda con filtros para ver los más antiguos.`,
      "VALIDATION",
    );
  }

  // Los filtros propios de cada fuente excluyen a la otra: el estado es fiscal; clase y factura son de remitos.
  const incluirFiscales = tipo !== "REMITO" && !filtros.clase && !filtros.factura;
  const incluirRemitos = (tipo === "" || tipo === "REMITO") && !filtros.estado;

  const fiscales = async () => {
    if (!incluirFiscales) return { rows: [] as unknown[], count: 0 };
    let query = supabase
      .from("facturas_electronicas")
      .select(FACTURA_RESUMEN_COLUMNS, { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("fecha_comprobante", { ascending: false })
      .order("created_at", { ascending: false })
      .range(0, necesarios - 1);
    if (tipo) query = query.eq("documento_tipo", tipo);
    if (filtros.estado) query = query.eq("estado", filtros.estado);
    if (filtros.ambiente) query = query.eq("ambiente", filtros.ambiente);
    if (filtros.desde) query = query.gte("fecha_comprobante", filtros.desde);
    if (filtros.hasta) query = query.lte("fecha_comprobante", filtros.hasta);
    if (search) query = query.or(facturaSearchConditions(search).join(","));
    const { data, error, count } = await query;
    if (error) throw error;
    return { rows: (data ?? []) as unknown[], count: count ?? 0 };
  };

  const remitos = async () => {
    if (!incluirRemitos) return { rows: [] as unknown[], count: 0 };
    let query = supabase
      .from("remitos")
      .select(REMITO_RESUMEN_COLUMNS, { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("fecha_emision", { ascending: false })
      .order("created_at", { ascending: false })
      .range(0, necesarios - 1);
    if (filtros.ambiente) query = query.eq("ambiente", filtros.ambiente);
    if (filtros.clase) query = query.eq("clase", filtros.clase);
    if (filtros.factura === "con") query = query.not("factura_id", "is", null);
    if (filtros.factura === "sin") query = query.is("factura_id", null);
    if (filtros.desde) query = query.gte("fecha_emision", filtros.desde);
    if (filtros.hasta) query = query.lte("fecha_emision", filtros.hasta);
    if (search) query = query.or(remitoSearchConditions(search).join(","));
    const { data, error, count } = await query;
    if (error) throw error;
    return { rows: (data ?? []) as unknown[], count: count ?? 0 };
  };

  const [fiscal, remito] = await Promise.all([fiscales(), remitos()]);

  const entradas: Entrada[] = [
    ...fiscal.rows.map((row): Entrada => {
      const factura = mapSummary(row);
      return {
        fecha: factura.fechaComprobante,
        createdAt: timestamp(factura.createdAt),
        item: { tipo: "FISCAL", id: factura.id, fecha: factura.fechaComprobante, factura },
      };
    }),
    ...remito.rows.map((row): Entrada => {
      const resumen = mapResumen(row);
      return {
        fecha: resumen.fechaEmision,
        createdAt: timestamp((row as Record<string, unknown>).created_at),
        item: { tipo: "REMITO", id: resumen.id, fecha: resumen.fechaEmision, remito: resumen },
      };
    }),
  ];
  entradas.sort((a, b) => (
    b.fecha.localeCompare(a.fecha) || b.createdAt - a.createdAt || b.item.id.localeCompare(a.item.id)
  ));

  const desde = (page - 1) * pageSize;
  return {
    items: entradas.slice(desde, desde + pageSize).map((entrada) => entrada.item),
    page,
    pageSize,
    total: fiscal.count + remito.count,
  };
}
