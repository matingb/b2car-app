import { FacturacionValidationError, testFacturacionConnection } from "@/lib/facturacion/facturacionService";
import { getFacturacionAmbiente } from "@/lib/facturacion/environment";
import { Permission } from "@/lib/permissions";
import { facturacionErrorResponse, requireTenantPlanPermissionAdmin } from "@/lib/facturacion/serverAuth";

export const runtime = "nodejs";

export async function POST() {
  try {
    const actor = await requireTenantPlanPermissionAdmin(Permission.ConfiguracionEdit);
    const result = await testFacturacionConnection(actor.tenantId, getFacturacionAmbiente());
    return Response.json({ data: result, error: null });
  } catch (error) {
    if (error instanceof FacturacionValidationError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    return facturacionErrorResponse(error);
  }
}
