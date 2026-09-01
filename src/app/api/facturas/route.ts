import { listFacturas } from "@/lib/facturacion/facturacionService";
import { facturacionErrorResponse, requireTenantActor } from "@/lib/facturacion/serverAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireTenantActor();
    const params = new URL(request.url).searchParams;
    const result = await listFacturas(actor.tenantId, {
      page: Number(params.get("page") || 1),
      pageSize: Number(params.get("pageSize") || 25),
      estado: params.get("estado"),
      ambiente: params.get("ambiente"),
      documentoTipo: params.get("documentoTipo"),
      desde: params.get("desde"),
      hasta: params.get("hasta"),
      search: params.get("search"),
    });
    return Response.json({ data: result, error: null });
  } catch (error) {
    return facturacionErrorResponse(error);
  }
}
