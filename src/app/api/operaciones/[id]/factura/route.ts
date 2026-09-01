import {
  FacturacionValidationError,
  getVentaFacturaPreflight,
  issueVentaElectronica,
  parseFacturaIssueInput,
} from "@/lib/facturacion/facturacionService";
import {
  facturacionErrorResponse,
  requireTenantActor,
  requireTenantAdmin,
} from "@/lib/facturacion/serverAuth";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireTenantActor();
    const { id } = await params;
    const ambiente = new URL(request.url).searchParams.get("ambiente") === "PRODUCCION"
      ? "PRODUCCION" : "HOMOLOGACION";
    const result = await getVentaFacturaPreflight(actor, id, ambiente);
    return Response.json({
      data: { ...result, canEmit: actor.role === "admin" && actor.claimedRole === "admin" },
      error: null,
    });
  } catch (error) {
    if (error instanceof FacturacionValidationError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    return facturacionErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireTenantAdmin();
    const { id } = await params;
    const result = await issueVentaElectronica(actor, id, parseFacturaIssueInput(await request.json().catch(() => null)));
    return Response.json({ data: result.invoice, error: result.message ?? null }, { status: result.httpStatus });
  } catch (error) {
    if (error instanceof FacturacionValidationError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    return facturacionErrorResponse(error);
  }
}
