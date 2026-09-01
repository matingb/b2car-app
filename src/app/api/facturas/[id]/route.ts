import { FacturacionValidationError, getFacturaDetalle } from "@/lib/facturacion/facturacionService";
import { facturacionErrorResponse, requireTenantActor } from "@/lib/facturacion/serverAuth";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireTenantActor();
    const { id } = await params;
    return Response.json({
      data: await getFacturaDetalle(actor.tenantId, id),
      canManage: actor.role === "admin" && actor.claimedRole === "admin",
      error: null,
    });
  } catch (error) {
    if (error instanceof FacturacionValidationError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    return facturacionErrorResponse(error);
  }
}
