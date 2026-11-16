import { getFacturacionAmbiente } from "@/lib/facturacion/environment";
import { Permission } from "@/lib/permissions";
import { isValidUuid } from "@/lib/uuid";
import type { ComprobanteRecibido, ComprobantesOperacion } from "@/lib/comprobantesRecibidos/types";
import { ApiError } from "../../../apiError";
import { createApiHandler } from "../../../apiHandler";
import { parseInput, readJsonBody, uuidParams } from "../../../apiInput";
import { comprobanteRecibidoService } from "../../../comprobantes-recibidos/comprobanteRecibidoService";
import {
  mapComprobanteRecibidoError,
  parseComprobanteBody,
  unwrapComprobanteResult,
} from "../../../comprobantes-recibidos/comprobanteRecibidoHttp";

export const runtime = "nodejs";

export type GetComprobantesOperacionResponse = { data: ComprobantesOperacion; error: null };
export type CreateComprobanteRecibidoResponse = { data: ComprobanteRecibido; error: null };

/**
 * Facturas y retenciones de una compra o gasto, con la comparación informativa contra el monto
 * operativo y la precarga fiscal (copia editable de la ficha del proveedor y del tenant).
 */
export const GET = createApiHandler(
  {
    route: "GET /api/operaciones/[id]/comprobantes-recibidos",
    fallback: "No se pudieron cargar las facturas y retenciones de la operación",
    permission: Permission.ComprobantesRecibidosView,
  },
  async (ctx) => {
    const { id } = parseInput(uuidParams("id"), ctx.params);
    const result = await comprobanteRecibidoService.listByOperacion(ctx.supabase, ctx.actor.tenantId, id, getFacturacionAmbiente());
    const data = unwrapComprobanteResult(result, "No se pudieron cargar las facturas y retenciones de la operación");
    return Response.json({ data, error: null } satisfies GetComprobantesOperacionResponse);
  },
);

/**
 * Alta de una factura o retención en una operación ya persistida. Requiere `X-Idempotency-Key`
 * (o `idempotencyKey` en el cuerpo): reintentar la misma carga no duplica el documento ni repite
 * efectos de la operación, porque esta ruta no crea operaciones, pagos ni movimientos de stock.
 */
export const POST = createApiHandler(
  {
    route: "POST /api/operaciones/[id]/comprobantes-recibidos",
    fallback: "No se pudo guardar el documento",
    permission: Permission.ComprobantesRecibidosEdit,
    mapError: mapComprobanteRecibidoError,
  },
  async (ctx) => {
    const { id } = parseInput(uuidParams("id"), ctx.params);
    const body = await readJsonBody(ctx.req);
    const bodyKey = typeof body === "object" && body !== null ? (body as Record<string, unknown>).idempotencyKey : undefined;
    const idempotencyKey = ctx.req.headers.get("x-idempotency-key")?.trim() || bodyKey;
    if (!isValidUuid(idempotencyKey)) throw new ApiError(400, "X-Idempotency-Key inválida", "VALIDATION");

    const input = parseComprobanteBody(body);
    const result = await comprobanteRecibidoService.create(ctx.supabase, ctx.actor.tenantId, id, input, idempotencyKey);
    const data = unwrapComprobanteResult(result, "No se pudo guardar el documento");
    return Response.json({ data, error: null } satisfies CreateComprobanteRecibidoResponse, { status: 201 });
  },
);
