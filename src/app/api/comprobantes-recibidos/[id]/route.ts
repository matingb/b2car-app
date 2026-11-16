import { Permission } from "@/lib/permissions";
import type { ComprobanteRecibido } from "@/lib/comprobantesRecibidos/types";
import { createApiHandler } from "../../apiHandler";
import { parseInput, readJsonBody, uuidParams } from "../../apiInput";
import { comprobanteRecibidoService } from "../comprobanteRecibidoService";
import {
  mapComprobanteRecibidoError,
  parseComprobanteBody,
  unwrapComprobanteResult,
} from "../comprobanteRecibidoHttp";

export const runtime = "nodejs";

export type ComprobanteRecibidoResponse = { data: ComprobanteRecibido; error: null };
export type EliminarComprobanteRecibidoResponse = { data: { eliminado: true }; error: null };

export const GET = createApiHandler(
  {
    route: "GET /api/comprobantes-recibidos/[id]",
    fallback: "No se pudo cargar el documento",
    permission: Permission.ComprobantesRecibidosView,
  },
  async (ctx) => {
    const { id } = parseInput(uuidParams("id"), ctx.params);
    const result = await comprobanteRecibidoService.getById(ctx.supabase, ctx.actor.tenantId, id);
    const data = unwrapComprobanteResult(result, "No se pudo cargar el documento");
    return Response.json({ data, error: null } satisfies ComprobanteRecibidoResponse);
  },
);

/** Edición explícita del documento. No actualiza la ficha del proveedor ni la operación. */
export const PUT = createApiHandler(
  {
    route: "PUT /api/comprobantes-recibidos/[id]",
    fallback: "No se pudo guardar el documento",
    permission: Permission.ComprobantesRecibidosEdit,
    mapError: mapComprobanteRecibidoError,
  },
  async (ctx) => {
    const { id } = parseInput(uuidParams("id"), ctx.params);
    const input = parseComprobanteBody(await readJsonBody(ctx.req));
    const result = await comprobanteRecibidoService.update(ctx.supabase, ctx.actor.tenantId, id, input);
    const data = unwrapComprobanteResult(result, "No se pudo guardar el documento");
    return Response.json({ data, error: null } satisfies ComprobanteRecibidoResponse);
  },
);

/** Elimina solo el documento. La operación, sus pagos y su stock no cambian. */
export const DELETE = createApiHandler(
  {
    route: "DELETE /api/comprobantes-recibidos/[id]",
    fallback: "No se pudo eliminar el documento",
    permission: Permission.ComprobantesRecibidosEdit,
  },
  async (ctx) => {
    const { id } = parseInput(uuidParams("id"), ctx.params);
    const result = await comprobanteRecibidoService.remove(ctx.supabase, id);
    unwrapComprobanteResult(result, "No se pudo eliminar el documento");
    return Response.json({ data: { eliminado: true }, error: null } satisfies EliminarComprobanteRecibidoResponse);
  },
);
