import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { fiscalTestCorte, fiscalTestFilters, fiscalTestHeader, fiscalTestId, fiscalTestLine } from "@/lib/facturacion/reporteFiscalTestData";
import { facturasReporteRepository, type FiscalHeader, type FiscalLine } from "./facturasReporteRepository";

type Query = { table: string; select: string; eq: Record<string, unknown>; lists: Record<string, unknown[]>; gt: Record<string, string>; gte: Record<string, string>; lte: Record<string, string>; or: string[]; order: string[]; limit: number };
type TestHeader = FiscalHeader & { estado?: string; ambiente?: string };
function database(headers: TestHeader[], lines: FiscalLine[] = [], options: { cap?: number; fail?: (q: Query, n: number) => boolean; duplicate?: boolean } = {}) {
  const queries: Query[] = [];
  const client = { from(table: string) {
    const q: Query = { table, select: "", eq: {}, lists: {}, gt: {}, gte: {}, lte: {}, or: [], order: [], limit: 0 };
    const builder = {
      select(value: string) { q.select = value; return builder; },
      eq(key: string, value: unknown) { q.eq[key] = value; return builder; },
      in(key: string, values: unknown[]) { q.lists[key] = values; return builder; },
      gt(key: string, value: string) { q.gt[key] = value; return builder; },
      gte(key: string, value: string) { q.gte[key] = value; return builder; },
      lte(key: string, value: string) { q.lte[key] = value; return builder; },
      or(value: string) { q.or.push(value); return builder; },
      order(key: string) { q.order.push(key); return builder; },
      limit(value: number) { q.limit = value; return builder; },
      then(resolve: (value: unknown) => unknown) {
        queries.push(q);
        if (options.fail?.(q, queries.length)) return Promise.resolve(resolve({ data: null, error: { code: "XX000", message: "fallo sintético" } }));
        const isLines = table.endsWith("_lineas");
        let data: Record<string, unknown>[] = (isLines ? lines : headers) as unknown as Record<string, unknown>[];
        data = data.filter(row => Object.entries(q.eq).every(([key, value]) => {
          if (key === "facturas_electronicas.tenant_id") return headers.some(h => h.id === row.factura_id && h.tenant_id === value);
          if (key === "emisor_snapshot->>cuit") return (row.emisor_snapshot as { cuit: string }).cuit === value;
          return (row[key] ?? (key === "estado" ? "AUTORIZADA" : key === "ambiente" ? "PRODUCCION" : undefined)) === value;
        }));
        data = data.filter(row => Object.entries(q.lists).every(([key, values]) => values.includes(row[key])));
        data = data.filter(row => Object.entries(q.gte).every(([key, v]) => String(row[key]) >= v) && Object.entries(q.lte).every(([key, v]) => String(row[key]) <= v));
        if (!options.duplicate) data = data.filter(row => Object.entries(q.gt).every(([key, v]) => String(row[key]) > v));
        for (const expr of q.or) {
          if (expr.startsWith("autorizada_at")) data = data.filter(row => String(row.autorizada_at ?? row.created_at) <= fiscalTestCorte);
          else if (!options.duplicate) {
            const match = /fecha_comprobante.gt.([^,]+),and\(fecha_comprobante.eq.[^,]+,id.gt.([^)]+)\)/.exec(expr)!;
            data = data.filter(row => String(row.fecha_comprobante) > match[1] || row.fecha_comprobante === match[1] && String(row.id) > match[2]);
          }
        }
        data = [...data].sort((a, b) => {
          for (const key of q.order) { const comparison = String(a[key]).localeCompare(String(b[key])); if (comparison) return comparison; }
          return 0;
        }).slice(0, Math.min(q.limit, options.cap ?? 1000));
        return Promise.resolve(resolve({ data, error: null }));
      },
    };
    return builder;
  } } as unknown as SupabaseClient;
  return { client, queries };
}

describe("repositorio fiscal", () => {
  it.each(["PRODUCCION", "HOMOLOGACION"] as const)("selecciona solo autorizados del ambiente %s", async ambiente => {
    const production = { ...fiscalTestHeader(), ambiente: "PRODUCCION" };
    const homologacion = { ...fiscalTestHeader({ id: fiscalTestId(2) }), ambiente: "HOMOLOGACION" };
    const db = database([production, homologacion,
      { ...fiscalTestHeader({ id: fiscalTestId(3) }), ambiente, estado: "BORRADOR" },
      { ...fiscalTestHeader({ id: fiscalTestId(4), tenant_id: "tenant-b" }), ambiente },
    ]);
    const result = await facturasReporteRepository.read(db.client, "tenant-a", { ...fiscalTestFilters, ambiente }, fiscalTestCorte);
    expect(result.error).toBeNull();
    expect(result.data?.headers).toEqual([ambiente === "PRODUCCION" ? production : homologacion]);
    expect(db.queries[0].eq).toMatchObject({ tenant_id: "tenant-a", estado: "AUTORIZADA", ambiente });
  });
  it("recorre 1205 cabeceras con empates, límite servidor menor y autorización concurrente excluida", async () => {
    const headers = Array.from({ length: 1205 }, (_, i) => fiscalTestHeader({ id: fiscalTestId(i + 1), fecha_comprobante: i < 600 ? "2026-10-01" : "2026-10-31" }));
    const db = database([...headers,
      fiscalTestHeader({ id: fiscalTestId(2000), autorizada_at: "2026-11-02T19:00:00Z" }),
      { ...fiscalTestHeader({ id: fiscalTestId(2001) }), estado: "BORRADOR" },
      { ...fiscalTestHeader({ id: fiscalTestId(2002) }), ambiente: "HOMOLOGACION" },
      fiscalTestHeader({ id: fiscalTestId(2003), tenant_id: "tenant-b" }),
    ], [], { cap: 73 });
    const result = await facturasReporteRepository.read(db.client, "tenant-a", fiscalTestFilters, fiscalTestCorte);
    expect(result.error).toBeNull();
    expect(result.data?.headers.map(h => h.id)).toEqual(headers.map(h => h.id));
    expect(db.queries[0].order).toEqual(["fecha_comprobante", "id"]);
    expect(db.queries[0].or[0]).toContain(`autorizada_at.lte.${fiscalTestCorte}`);
    expect(db.queries[1].or).toHaveLength(2);
  });
  it("usa created_at para históricos y aplica documento, origen, CUIT y fechas inclusivas", async () => {
    const good = fiscalTestHeader({ autorizada_at: null, documento_tipo: "NOTA_CREDITO", origen_tipo: "VENTA" });
    const db = database([good,
      fiscalTestHeader({ id: fiscalTestId(2), autorizada_at: null, created_at: "2026-11-03T00:00:00Z" }),
      fiscalTestHeader({ id: fiscalTestId(3), fecha_comprobante: "2026-09-30" }),
      fiscalTestHeader({ id: fiscalTestId(4) }),
    ]);
    const result = await facturasReporteRepository.read(db.client, "tenant-a", { ...fiscalTestFilters, documentoTipo: "NOTA_CREDITO", origenTipo: "VENTA", cuitEmisor: "20111111112" }, fiscalTestCorte);
    expect(result.data?.headers).toEqual([good]);
    expect(db.queries[0].or[0]).toContain("and(autorizada_at.is.null,created_at.lte.");
    expect(db.queries[0].eq).toMatchObject({ documento_tipo: "NOTA_CREDITO", origen_tipo: "VENTA", "emisor_snapshot->>cuit": "20111111112" });
  });
  it("pagina más de 1000 líneas de una factura, referencias fuera de período y aísla tenants", async () => {
    const original = fiscalTestHeader({ id: fiscalTestId(2), fecha_comprobante: "2026-09-15" });
    const foreign = fiscalTestHeader({ id: fiscalTestId(3), tenant_id: "tenant-b" });
    const headers = [fiscalTestHeader({ documento_asociado_id: original.id }), original, foreign,
      fiscalTestHeader({ id: fiscalTestId(4), documento_asociado_id: foreign.id })];
    const lines = Array.from({ length: 1205 }, (_, i) => fiscalTestLine({ id: fiscalTestId(i + 10000) }));
    const db = database(headers, [...lines, fiscalTestLine({ id: fiscalTestId(30000), factura_id: foreign.id })]);
    const result = await facturasReporteRepository.read(db.client, "tenant-a", fiscalTestFilters, fiscalTestCorte);
    expect(result.error).toBeNull();
    expect(result.data?.lines).toHaveLength(1205);
    expect(result.data?.headers).toHaveLength(2);
    expect(result.data?.associated).toEqual([original]);
    for (const q of db.queries.filter(q => q.table.endsWith("_lineas"))) {
      expect(q.eq["facturas_electronicas.tenant_id"]).toBe("tenant-a");
      expect(q.select).toContain("!inner(tenant_id)");
    }
  });
  it.each(["headers", "lines", "associated"])("no entrega parciales ante fallo de %s", async where => {
    const db = database([fiscalTestHeader({ documento_asociado_id: fiscalTestId(2) })], [fiscalTestLine()], {
      cap: 1, fail: (q, n) => where === "headers" ? n === 2 : where === "lines" ? q.table.endsWith("_lineas") && Boolean(q.gt.id) : Boolean(q.lists.id),
    });
    const result = await facturasReporteRepository.read(db.client, "tenant-a", fiscalTestFilters, fiscalTestCorte);
    expect(result.data).toBeNull(); expect(result.error).not.toBeNull();
  });
  it("detecta IDs duplicados y aborta", async () => {
    const db = database([fiscalTestHeader()], [], { duplicate: true });
    expect((await facturasReporteRepository.read(db.client, "tenant-a", fiscalTestFilters, fiscalTestCorte)).data).toBeNull();
  });
});
