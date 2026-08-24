import type { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import { logger } from "@/lib/logger";
import type {
  ActualizarTransferenciaFinancieraResponse,
  EliminarFinanzasResponse,
  TransferenciaFinanciera,
} from "@/model/finanzas";
import {
  rpcStatus,
  validateUpdateTransferencia,
  validateUuid,
} from "../../finanzasRouteUtils";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    logger.warn("[PUT /api/cuentas-financieras/transferencias/[id]] No autenticado");
    return Response.json({ data: null, error: "Unauthorized" } satisfies ActualizarTransferenciaFinancieraResponse, { status: 401 });
  }

  const { id } = await params;
  const idError = validateUuid(id, "transferenciaId");
  if (idError) {
    logger.error("[PUT /api/cuentas-financieras/transferencias/[id]] ID inválido:", id);
    return Response.json({ data: null, error: idError } satisfies ActualizarTransferenciaFinancieraResponse, { status: 400 });
  }
  const rawBody = await req.json().catch(() => null);
  const parsed = validateUpdateTransferencia(rawBody);
  if (parsed.error || !parsed.value) {
    logger.error("[PUT /api/cuentas-financieras/transferencias/[id]] Validación fallida:", parsed.error, { rawBody });
    return Response.json({ data: null, error: parsed.error ?? "JSON inválido" } satisfies ActualizarTransferenciaFinancieraResponse, { status: 400 });
  }

  const input = parsed.value;
  const { error: updateError } = await supabase.rpc("rpc_actualizar_movimiento_cuenta", {
    p_operacion_id: id,
    p_cuenta_origen_id: input.cuentaOrigenId ?? null,
    p_cuenta_destino_id: input.cuentaDestinoId ?? null,
    p_importe: input.importe ?? null,
    p_fecha: input.fecha ?? null,
    p_descripcion: input.descripcion === undefined ? null : input.descripcion,
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  if (updateError) {
    logger.error("[PUT /api/cuentas-financieras/transferencias/[id]] Error en RPC rpc_actualizar_movimiento_cuenta:", updateError, { id, input });
    const status = rpcStatus(updateError);
    return Response.json(
      { data: null, error: updateError.message || (status === 404 ? "Transferencia no encontrada" : "Error actualizando transferencia") } satisfies ActualizarTransferenciaFinancieraResponse,
      { status }
    );
  }

  const result: TransferenciaFinanciera = {
    id,
    cuentaOrigenId: input.cuentaOrigenId ?? "",
    cuentaOrigenNombre: null,
    cuentaDestinoId: input.cuentaDestinoId ?? "",
    cuentaDestinoNombre: null,
    importe: input.importe ?? 0,
    fecha: input.fecha ?? new Date().toISOString(),
    descripcion: input.descripcion ?? null,
    reversaMovimientoId: null,
    createdAt: new Date().toISOString(),
  };

  return Response.json({ data: result, error: null } satisfies ActualizarTransferenciaFinancieraResponse, { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    logger.warn("[DELETE /api/cuentas-financieras/transferencias/[id]] No autenticado");
    return Response.json({ error: "Unauthorized" } satisfies EliminarFinanzasResponse, { status: 401 });
  }

  const { id } = await params;
  const idError = validateUuid(id, "transferenciaId");
  if (idError) {
    logger.error("[DELETE /api/cuentas-financieras/transferencias/[id]] ID inválido:", id);
    return Response.json({ error: idError } satisfies EliminarFinanzasResponse, { status: 400 });
  }

  const { data, error } = await supabase.rpc("rpc_eliminar_movimiento_cuenta", {
    p_operacion_id: id,
  });
  if (error || data === false) {
    logger.error("[DELETE /api/cuentas-financieras/transferencias/[id]] Error eliminando transferencia:", error, { id, data });
    const status = data === false ? 404 : rpcStatus(error);
    return Response.json(
      { error: (error && error.message) || (status === 404 ? "Transferencia no encontrada" : "Error eliminando transferencia") } satisfies EliminarFinanzasResponse,
      { status }
    );
  }
  return Response.json({ error: null } satisfies EliminarFinanzasResponse, { status: 200 });
}

