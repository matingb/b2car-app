import {
  FacturacionValidationError,
  issueNotaFiscal,
  parseNotaInput,
} from "@/lib/facturacion/facturacionService";
import { facturacionErrorResponse, requireTenantActor } from "@/lib/facturacion/serverAuth";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireTenantActor();
    const { id } = await params;
    const input = parseNotaInput(await request.json().catch(() => null));
    const result = await issueNotaFiscal(actor, id, input);
    return Response.json({ data: result.invoice, error: result.message ?? null }, { status: result.httpStatus });
  } catch (error) {
    if (error instanceof FacturacionValidationError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    return facturacionErrorResponse(error);
  }
}
