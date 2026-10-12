import { getFacturacionAmbiente } from "@/lib/facturacion/environment";
import { listDocumentosAsociados } from "@/lib/documentos/documentosService";
import { Permission } from "@/lib/permissions";
import { createApiHandler } from "../../../apiHandler";
import { parseInput, uuidParams } from "../../../apiInput";

export const GET = createApiHandler(
  {
    route: "GET /api/arreglos/[id]/documentos",
    fallback: "No se pudieron cargar los documentos del arreglo",
    permission: Permission.FacturasView,
  },
  async (ctx) => {
    const { id } = parseInput(uuidParams("id"), ctx.params);
    const data = await listDocumentosAsociados(ctx.supabase, ctx.actor.tenantId, getFacturacionAmbiente(), { tipo: "ARREGLO", id });
    return Response.json({ data, error: null });
  },
);
