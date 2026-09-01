import { FacturacionValidationError, testFacturacionConnection } from "@/lib/facturacion/facturacionService";
import { facturacionErrorResponse, requireTenantAdmin } from "@/lib/facturacion/serverAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireTenantAdmin();
    const body = await request.json().catch(() => null) as { ambiente?: string } | null;
    const ambiente = body?.ambiente === "PRODUCCION" ? "PRODUCCION" : "HOMOLOGACION";
    const result = await testFacturacionConnection(actor.tenantId, ambiente);
    return Response.json({ data: result, error: null });
  } catch (error) {
    if (error instanceof FacturacionValidationError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    return facturacionErrorResponse(error);
  }
}
