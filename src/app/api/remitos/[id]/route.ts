import { Permission } from "@/lib/permissions";
import { getRemitoDetalle } from "@/lib/remitos/remitosService";
import { createApiHandler } from "../../apiHandler";
import { parseInput, uuidParams } from "../../apiInput";

export const GET = createApiHandler(
  {
    route: "GET /api/remitos/[id]",
    fallback: "No se pudo cargar el remito",
    permission: Permission.FacturasView,
  },
  async (ctx) => {
    const { id } = parseInput(uuidParams("id"), ctx.params);
    const data = await getRemitoDetalle(ctx.supabase, ctx.actor.tenantId, id);
    return Response.json({ data, canManage: ctx.can(Permission.FacturasEdit), error: null });
  },
);
