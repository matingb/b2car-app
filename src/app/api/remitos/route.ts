import { getFacturacionAmbiente } from "@/lib/facturacion/environment";
import { Permission } from "@/lib/permissions";
import { emitirRemito, listRemitos } from "@/lib/remitos/remitosService";
import { parseEmitirRemitoInput } from "@/lib/remitos/remitoValidation";
import { createApiHandler } from "../apiHandler";
import { parseInput, readJsonBody } from "../apiInput";
import { REMITO_CONSTRAINT_MESSAGES } from "./remitosRouteUtils";

export const GET = createApiHandler(
  {
    route: "GET /api/remitos",
    fallback: "No se pudieron cargar los remitos",
    permission: Permission.FacturasView,
  },
  async (ctx) => {
    const params = ctx.req.nextUrl.searchParams;
    const data = await listRemitos(ctx.supabase, ctx.actor.tenantId, getFacturacionAmbiente(), {
      page: Number(params.get("page") || 1),
      pageSize: Number(params.get("pageSize") || 25),
      clase: params.get("clase"),
      factura: params.get("factura"),
      desde: params.get("desde"),
      hasta: params.get("hasta"),
      search: params.get("search"),
    });
    return Response.json({ data, error: null });
  },
);

export const POST = createApiHandler(
  {
    route: "POST /api/remitos",
    fallback: "No se pudo emitir el remito",
    permission: Permission.FacturasEdit,
  },
  async (ctx) => {
    const input = parseInput(parseEmitirRemitoInput, await readJsonBody(ctx.req));
    try {
      const id = await emitirRemito(ctx.supabase, getFacturacionAmbiente(), input);
      return Response.json({ data: { id }, error: null }, { status: 201 });
    } catch (error) {
      return ctx.fail(error, { constraintMessages: REMITO_CONSTRAINT_MESSAGES });
    }
  },
);
