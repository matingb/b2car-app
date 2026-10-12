import { Permission } from "@/lib/permissions";
import { getFacturaRemitos } from "@/lib/remitos/remitosService";
import { createApiHandler } from "../../../apiHandler";
import { parseInput, uuidParams } from "../../../apiInput";

export const GET = createApiHandler(
  {
    route: "GET /api/facturas/[id]/remitos",
    fallback: "No se pudieron cargar los remitos de la factura",
    permission: Permission.FacturasView,
  },
  async (ctx) => {
    const { id } = parseInput(uuidParams("id"), ctx.params);
    const data = await getFacturaRemitos(ctx.supabase, ctx.actor.tenantId, id);
    return Response.json({ data, error: null });
  },
);
