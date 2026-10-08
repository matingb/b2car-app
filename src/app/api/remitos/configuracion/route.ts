import { getFacturacionAmbiente } from "@/lib/facturacion/environment";
import { Permission } from "@/lib/permissions";
import { getRemitosConfiguracion, saveRemitosConfiguracion } from "@/lib/remitos/remitosService";
import { parseRemitosConfiguracionInput } from "@/lib/remitos/remitoValidation";
import { createApiHandler } from "../../apiHandler";
import { parseInput, readJsonBody } from "../../apiInput";

export const GET = createApiHandler(
  {
    route: "GET /api/remitos/configuracion",
    fallback: "No se pudo cargar la configuración de remitos",
    permission: [Permission.ConfiguracionView, Permission.FacturasView],
  },
  async (ctx) => {
    const data = await getRemitosConfiguracion(ctx.supabase, ctx.actor.tenantId, getFacturacionAmbiente());
    return Response.json({ data, error: null });
  },
);

export const PUT = createApiHandler(
  {
    route: "PUT /api/remitos/configuracion",
    fallback: "No se pudo guardar la configuración de remitos",
    permission: [Permission.ConfiguracionEdit, Permission.FacturasEdit],
  },
  async (ctx) => {
    const input = parseInput(parseRemitosConfiguracionInput, await readJsonBody(ctx.req));
    const data = await saveRemitosConfiguracion(
      ctx.supabase,
      ctx.actor.tenantId,
      ctx.actor.userId,
      getFacturacionAmbiente(),
      input,
    );
    return Response.json({ data, error: null });
  },
);
