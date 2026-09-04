import { FacturacionValidationError, reconcileFactura } from "@/lib/facturacion/facturacionService";
import { facturacionErrorResponse, requireTenantActor } from "@/lib/facturacion/serverAuth";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireTenantActor();
    const { id } = await params;
    return Response.json({ data: await reconcileFactura(actor, id), error: null });
  } catch (error) {
    if (error instanceof FacturacionValidationError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    return facturacionErrorResponse(error);
  }
}
