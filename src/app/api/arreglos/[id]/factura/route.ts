import {
  FacturacionValidationError,
  getFacturaPreflight,
  issueFacturaElectronica,
  parseFacturaIssueInput,
} from "@/lib/facturacion/facturacionService";
import { getFacturacionAmbiente } from "@/lib/facturacion/environment";
import { FceMipymeRequiredError } from "@/lib/facturacion/fceMipyme";
import {
  facturacionErrorResponse,
  requireTenantActor,
} from "@/lib/facturacion/serverAuth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireTenantActor();
    const { id } = await params;
    const result = await getFacturaPreflight(actor, id, getFacturacionAmbiente());
    return Response.json({
      data: {
        ...result,
        canEmit: Boolean(result.preflight.puedeEmitir),
      },
      error: null,
    });
  } catch (error) {
    if (error instanceof FacturacionValidationError) {
      return Response.json({
        error: error.message,
        code: error instanceof FceMipymeRequiredError ? error.code : null,
      }, { status: 422 });
    }
    return facturacionErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireTenantActor();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const input = parseFacturaIssueInput(body);
    const result = await issueFacturaElectronica(actor, id, input);
    return Response.json({ data: result.invoice, error: result.message ?? null }, { status: result.httpStatus });
  } catch (error) {
    logger.error("Error al emitir la factura:", error);
    if (error instanceof FacturacionValidationError) {
      return Response.json({
        error: error.message,
        code: error instanceof FceMipymeRequiredError ? error.code : null,
      }, { status: 422 });
    }
    return facturacionErrorResponse(error);
  }
}
