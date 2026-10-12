import { FacturacionValidationError, getDevolucionesDisponibles } from "@/lib/facturacion/facturacionService";
import { facturacionErrorResponse, requireTenantBillingActor } from "@/lib/facturacion/serverAuth";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireTenantBillingActor();
    const { id } = await params;
    return Response.json({ data: await getDevolucionesDisponibles(actor.tenantId, id), error: null });
  } catch (error) {
    if (error instanceof FacturacionValidationError) return Response.json({ error: error.message }, { status: 404 });
    return facturacionErrorResponse(error);
  }
}
