import {
  FacturacionValidationError,
  parseFacturaPreviewRequest,
  previewSourceFactura,
} from "@/lib/facturacion/facturacionService";
import { FACTURA_NO_STORE_HEADERS, facturaValidationErrorResponse } from "@/lib/facturacion/facturaHttp";
import { facturacionErrorResponse, requireTenantBillingActor } from "@/lib/facturacion/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Revisión previa del comprobante: valida y prepara sin numerar, emitir ni escribir. */
export async function POST(request: Request) {
  try {
    const actor = await requireTenantBillingActor();
    const preview = parseFacturaPreviewRequest(await request.json().catch(() => null));
    const { revision, issues } = await previewSourceFactura(actor, preview.origenTipo, preview.origenId, preview.draft);
    const firstError = issues.find((issue) => issue.severidad === "error");
    return Response.json(
      { data: revision, error: revision ? null : firstError?.mensaje ?? "Revisá los datos de la factura", issues },
      { status: revision ? 200 : 422, headers: FACTURA_NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof FacturacionValidationError) return facturaValidationErrorResponse(error);
    return facturacionErrorResponse(error);
  }
}
