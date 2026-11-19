import type { SupabaseClient } from "@supabase/supabase-js";
import { ServiceError, toServiceError } from "@/app/api/serviceError";
import { buildComprasFiscalReport } from "@/lib/comprobantesRecibidos/reporteFiscalCalculos";
import { comprasFiscalFilename, type ComprasFiscalFilters, type ComprasFiscalReport } from "@/lib/comprobantesRecibidos/reporteFiscal";
import { serializeComprasFiscalReport } from "@/lib/comprobantesRecibidos/reporteFiscalSerializers";
import { comprobantesReporteRepository, type ComprobantesReporteRepository } from "./comprobantesReporteRepository";

type Serializer = (report: ComprasFiscalReport) => Promise<{ body: string | ArrayBuffer; mime: string }>;

export function createComprobantesReporteService(
  repo: ComprobantesReporteRepository = comprobantesReporteRepository,
  serialize: Serializer = serializeComprasFiscalReport,
) {
  return {
    async generate(client: SupabaseClient, tenantId: string, filters: ComprasFiscalFilters) {
      try {
        const result = await repo.read(client, tenantId, filters);
        if (result.error) {
          return {
            data: null,
            error: "code" in result.error ? toServiceError(result.error) : ServiceError.Unknown,
          };
        }
        const report = buildComprasFiscalReport(result.data, filters);
        const file = await serialize(report);
        return { data: { ...file, filename: comprasFiscalFilename(filters) }, error: null };
      } catch {
        return { data: null, error: ServiceError.Unknown };
      }
    },
  };
}

export const comprobantesReporteService = createComprobantesReporteService();
