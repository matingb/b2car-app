import { getDocumentoResumen } from "@/lib/facturacion/facturacionService";
import { getFacturacionAmbiente } from "@/lib/facturacion/environment";
import {
  facturacionErrorResponse,
  requireTenantBillingActor,
} from "@/lib/facturacion/serverAuth";

export const runtime = "nodejs";

/**
 * Estado de la factura del arreglo para el detalle. No consulta ARCA: la
 * preflight completa (padrón, condición IVA, FCE) queda para el modal de emisión.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireTenantBillingActor();
    const { id } = await params;
    const factura = await getDocumentoResumen(actor, "ARREGLO", id, getFacturacionAmbiente());
    return Response.json({ data: { factura }, error: null });
  } catch (error) {
    return facturacionErrorResponse(error);
  }
}
