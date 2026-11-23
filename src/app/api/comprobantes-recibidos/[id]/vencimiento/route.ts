import { Permission } from "@/lib/permissions";
import { createApiHandler } from "../../../apiHandler";
import { parseInput, uuidParams } from "../../../apiInput";
import { unwrapComprobanteResult } from "../../comprobanteRecibidoHttp";
import { comprobanteRecibidoService } from "../../comprobanteRecibidoService";

export const runtime = "nodejs";

const fallback = "No se pudo agregar el vencimiento al calendario";

export const POST = createApiHandler(
  {
    route: "POST /api/comprobantes-recibidos/[id]/vencimiento",
    fallback,
    permission: Permission.ComprobantesRecibidosEdit,
  },
  async (ctx) => {
    const { id } = parseInput(uuidParams("id"), ctx.params);
    const result = await comprobanteRecibidoService.crearTurnoVencimiento(ctx.supabase, ctx.actor.tenantId, id);
    return Response.json({ data: unwrapComprobanteResult(result, fallback), error: null });
  },
);
