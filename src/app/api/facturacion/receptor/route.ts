import {
  FacturacionValidationError,
  getReceptorPrecarga,
} from "@/lib/facturacion/facturacionService";
import { FACTURA_NO_STORE_HEADERS, facturaValidationErrorResponse } from "@/lib/facturacion/facturaHttp";
import { facturacionErrorResponse, requireTenantBillingActor } from "@/lib/facturacion/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Precarga fiscal del cliente del arreglo o la venta; consulta ARCA y no modifica la ficha. */
export async function GET(request: Request) {
  try {
    const actor = await requireTenantBillingActor();
    const searchParams = new URL(request.url).searchParams;
    const origenTipo = searchParams.get("origenTipo");
    const origenId = searchParams.get("origenId")?.trim() ?? "";
    if ((origenTipo !== "ARREGLO" && origenTipo !== "VENTA") || !origenId || origenId.length > 64) {
      throw new FacturacionValidationError("El origen de la factura no es válido");
    }
    const data = await getReceptorPrecarga(actor, origenTipo, origenId);
    return Response.json({ data, error: null }, { headers: FACTURA_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof FacturacionValidationError) return facturaValidationErrorResponse(error);
    return facturacionErrorResponse(error);
  }
}
