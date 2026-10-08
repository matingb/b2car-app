import { getFacturacionAmbiente } from "@/lib/facturacion/environment";
import { Permission } from "@/lib/permissions";
import { getRemitoPreflight } from "@/lib/remitos/remitosService";
import { createApiHandler } from "../../apiHandler";
import { parseInput } from "../../apiInput";
import { parseOptionalArregloId, parseOptionalFacturaId } from "../remitosRouteUtils";

export const GET = createApiHandler(
  {
    route: "GET /api/remitos/preflight",
    fallback: "No se pudo preparar la emisión del remito",
    permission: Permission.FacturasEdit,
  },
  async (ctx) => {
    const facturaId = parseInput(parseOptionalFacturaId, ctx.req.nextUrl.searchParams.get("facturaId"));
    const arregloId = parseInput(parseOptionalArregloId, ctx.req.nextUrl.searchParams.get("arregloId"));
    const data = await getRemitoPreflight(ctx.supabase, ctx.actor.tenantId, getFacturacionAmbiente(), facturaId, arregloId);
    return Response.json({ data, error: null });
  },
);
