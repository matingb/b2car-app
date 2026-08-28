import {
  FacturacionValidationError,
  getFacturaPreflight,
  issueFacturaElectronica,
  parseFacturaIssueInput,
} from "@/lib/facturacion/facturacionService";
import {
  facturacionErrorResponse,
  requireTenantActor,
  requireTenantAdmin,
} from "@/lib/facturacion/serverAuth";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireTenantActor();
    const { id } = await params;
    const result = await getFacturaPreflight(actor, id);
    return Response.json({
      data: {
        ...result,
        canEmit: actor.role === "admin",
      },
      error: null,
    });
  } catch (error) {
    if (error instanceof FacturacionValidationError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    return facturacionErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireTenantAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const input = parseFacturaIssueInput(body);
    const result = await issueFacturaElectronica(actor, id, input);
    return Response.json({ data: result.invoice, error: result.message ?? null }, { status: result.httpStatus });
  } catch (error) {
    if (error instanceof FacturacionValidationError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    return facturacionErrorResponse(error);
  }
}
