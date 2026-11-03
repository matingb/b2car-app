import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/app/api/serviceError";
import { fiscalTestCorte, fiscalTestFilters, fiscalTestHeader, fiscalTestLine } from "@/lib/facturacion/reporteFiscalTestData";
import { createFacturasReporteService } from "./facturasReporteService";
import type { FacturasReporteRepository } from "./facturasReporteRepository";

const client = {} as SupabaseClient;
afterEach(() => vi.unstubAllEnvs());

describe("servicio fiscal inyectable", () => {
  it.each([
    ["PRODUCCION", "PRODUCCION"], ["HOMOLOGACION", "HOMOLOGACION"],
    [undefined, "HOMOLOGACION"], ["otro-valor", "HOMOLOGACION"],
  ])("deriva el ambiente de ARCA_AMBIENTE=%s y propaga sesión, filtros y corte", async (configured, ambiente) => {
    vi.stubEnv("ARCA_AMBIENTE", configured);
    const read = vi.fn<FacturasReporteRepository["read"]>().mockResolvedValue({ data: { headers: [fiscalTestHeader()], lines: [fiscalTestLine()], associated: [] }, error: null });
    const serialize = vi.fn().mockResolvedValue({ body: "archivo", mime: "text/csv" });
    const result = await createFacturasReporteService({ read }, serialize).generate(client, "tenant-a", fiscalTestFilters, fiscalTestCorte);
    expect(read).toHaveBeenCalledWith(client, "tenant-a", { ...fiscalTestFilters, ambiente }, fiscalTestCorte);
    expect(serialize.mock.calls[0][0]).toMatchObject({ tenantId: "tenant-a", filters: { ambiente }, corte: fiscalTestCorte, summary: { cantidad: 1, amounts: { total: 12100 } } });
    expect(result).toEqual({ data: { body: "archivo", mime: "text/csv", filename: "reporte-fiscal-ventas-2026-10-01_2026-10-31.csv" }, error: null });
  });
  it("no serializa una lectura fallida ni la presenta como conjunto vacío", async () => {
    const serialize = vi.fn();
    const read = vi.fn<FacturasReporteRepository["read"]>().mockResolvedValue({ data: null, error: { name: "PostgrestError", code: "XX000", message: "fallo", details: "", hint: "" } });
    expect(await createFacturasReporteService({ read }, serialize).generate(client, "tenant-a", fiscalTestFilters)).toEqual({ data: null, error: ServiceError.Unknown });
    expect(serialize).not.toHaveBeenCalled();
  });
  it("fallo de serialización, desbordamiento y excepción de lectura no entregan parcial", async () => {
    const source = { headers: [fiscalTestHeader()], lines: [fiscalTestLine()], associated: [] };
    const read = vi.fn<FacturasReporteRepository["read"]>().mockResolvedValue({ data: source, error: null });
    const broken = vi.fn().mockRejectedValue(new Error("fallo"));
    expect((await createFacturasReporteService({ read }, broken).generate(client, "tenant-a", fiscalTestFilters)).data).toBeNull();
    source.headers[0].total = "90071992547409.92";
    const serialize = vi.fn();
    expect((await createFacturasReporteService({ read }, serialize).generate(client, "tenant-a", fiscalTestFilters)).error).toBe(ServiceError.Unknown);
    expect(serialize).not.toHaveBeenCalled();
    read.mockRejectedValue(new Error("lectura"));
    expect((await createFacturasReporteService({ read }).generate(client, "tenant-a", fiscalTestFilters)).data).toBeNull();
  });
});
