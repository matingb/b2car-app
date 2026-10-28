import {
  buildFacturaDraftPdf,
  FacturacionValidationError,
  parseFacturaPreviewRequest,
} from "@/lib/facturacion/facturacionService";
import { facturaValidationErrorResponse } from "@/lib/facturacion/facturaHttp";
import { facturacionErrorResponse, requireTenantBillingActor } from "@/lib/facturacion/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PDF borrador de la revisión vigente; no se guarda ni sirve como comprobante. */
export async function POST(request: Request) {
  try {
    const actor = await requireTenantBillingActor();
    const preview = parseFacturaPreviewRequest(await request.json().catch(() => null));
    const pdf = await buildFacturaDraftPdf(actor, preview);
    return new Response(Uint8Array.from(pdf.bytes).buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${pdf.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof FacturacionValidationError) return facturaValidationErrorResponse(error);
    return facturacionErrorResponse(error);
  }
}
