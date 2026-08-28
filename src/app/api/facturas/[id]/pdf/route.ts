import { buildFacturaPdf, FacturacionValidationError } from "@/lib/facturacion/facturacionService";
import { facturacionErrorResponse, requireTenantActor } from "@/lib/facturacion/serverAuth";

export const runtime = "nodejs";

function safeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_") || "factura-c.pdf";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireTenantActor();
    const { id } = await params;
    const pdf = await buildFacturaPdf(actor.tenantId, id);
    const body = Uint8Array.from(pdf.bytes).buffer;
    return new Response(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${safeFilename(pdf.filename)}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof FacturacionValidationError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    return facturacionErrorResponse(error);
  }
}
