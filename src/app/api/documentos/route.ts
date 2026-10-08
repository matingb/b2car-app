import { listDocumentos } from "@/lib/documentos/documentosService";
import { Permission } from "@/lib/permissions";
import { createApiHandler } from "../apiHandler";

export const runtime = "nodejs";

export const GET = createApiHandler(
  {
    route: "GET /api/documentos",
    fallback: "No se pudieron cargar los documentos",
    permission: Permission.FacturasView,
  },
  async (ctx) => {
    const params = ctx.req.nextUrl.searchParams;
    const data = await listDocumentos(ctx.supabase, ctx.actor.tenantId, {
      page: Number(params.get("page") || 1),
      pageSize: Number(params.get("pageSize") || 25),
      tipo: params.get("tipo"),
      estado: params.get("estado"),
      ambiente: params.get("ambiente"),
      desde: params.get("desde"),
      hasta: params.get("hasta"),
      search: params.get("search"),
      clase: params.get("clase"),
      factura: params.get("factura"),
    });
    return Response.json({ data, error: null });
  },
);
