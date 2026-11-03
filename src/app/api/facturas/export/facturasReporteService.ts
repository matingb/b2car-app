import type { SupabaseClient } from "@supabase/supabase-js";
import { ServiceError, toServiceError } from "@/app/api/serviceError";
import { getFacturacionAmbiente } from "@/lib/facturacion/environment";
import { buildFiscalReport } from "@/lib/facturacion/reporteFiscalCalculos";
import { fiscalFilename, type FiscalFilters } from "@/lib/facturacion/reporteFiscal";
import { serializeFiscalReport, type FiscalSerializer } from "@/lib/facturacion/reporteFiscalSerializers";
import { facturasReporteRepository, type FacturasReporteRepository } from "./facturasReporteRepository";

/** No HTTP or external fiscal calls; failures never return a partly generated file. */
export function createFacturasReporteService(repo: FacturasReporteRepository = facturasReporteRepository, serialize: FiscalSerializer = serializeFiscalReport) {
  return {
    async generate(client: SupabaseClient, tenantId: string, filters: FiscalFilters, corte = new Date().toISOString()) {
      try {
        const scope = { ...filters, ambiente: getFacturacionAmbiente() };
        const result = await repo.read(client, tenantId, scope, corte);
        if (result.error) return { data: null, error: "code" in result.error ? toServiceError(result.error) : ServiceError.Unknown };
        const report = buildFiscalReport(result.data, tenantId, scope, corte);
        const file = await serialize(report);
        return { data: { ...file, filename: fiscalFilename(filters) }, error: null };
      } catch {
        // No raw database errors/snapshots in logs or client responses.
        return { data: null, error: ServiceError.Unknown };
      }
    },
  };
}
export const facturasReporteService = createFacturasReporteService();
