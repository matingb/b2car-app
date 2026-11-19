import { createClient } from "@/supabase/server";
import { Permission } from "@/lib/permissions";
import { facturacionErrorResponse, requireTenantPlanPermission } from "@/lib/facturacion/serverAuth";
import { ComprasFiscalQueryError, parseComprasFiscalFilters } from "@/lib/comprobantesRecibidos/reporteFiscal";
import { comprobantesReporteService } from "./comprobantesReporteService";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireTenantPlanPermission(Permission.ComprobantesRecibidosView);
    const filters = parseComprasFiscalFilters(new URL(request.url).searchParams);
    const result = await comprobantesReporteService.generate(await createClient(), actor.tenantId, filters);
    if (result.error || !result.data) {
      return Response.json({ error: "No se pudo generar el reporte fiscal de compras completo" }, {
        status: 500,
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    return new Response(result.data.body, {
      headers: {
        "Content-Type": result.data.mime,
        "Content-Disposition": `attachment; filename="${result.data.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const response = error instanceof ComprasFiscalQueryError
      ? Response.json({ error: error.message }, { status: 422 })
      : facturacionErrorResponse(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
