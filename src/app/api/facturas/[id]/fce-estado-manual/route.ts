import { updateFceManualStatus } from "@/lib/facturacion/facturacionService";
import { facturacionErrorResponse, requireTenantPlanPermissionAdmin } from "@/lib/facturacion/serverAuth";
import { Permission } from "@/lib/permissions";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireTenantPlanPermissionAdmin([Permission.FacturasEdit]);
    const { id } = await params;
    const body = await request.json().catch(() => null) as { estado?: unknown } | null;
    return Response.json({ data: await updateFceManualStatus(actor, id, body?.estado), error: null });
  } catch (error) {
    return facturacionErrorResponse(error);
  }
}
