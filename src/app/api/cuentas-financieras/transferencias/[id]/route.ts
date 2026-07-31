import type { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import type {
  ActualizarTransferenciaFinancieraResponse,
  EliminarFinanzasResponse,
} from "@/model/finanzas";
import {
  asRows,
  extractRpcId,
  mapTransferencia,
  rpcStatus,
  validateUpdateTransferencia,
  validateUuid,
} from "../../finanzasRouteUtils";

type RouteContext = { params: Promise<{ id: string }> };

function firstTransferencia(data: unknown) {
  return mapTransferencia(asRows(data)[0]);
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies ActualizarTransferenciaFinancieraResponse, { status: 401 });
  }

  const { id } = await params;
  const idError = validateUuid(id, "transferenciaId");
  if (idError) {
    return Response.json({ data: null, error: idError } satisfies ActualizarTransferenciaFinancieraResponse, { status: 400 });
  }
  const parsed = validateUpdateTransferencia(await req.json().catch(() => null));
  if (parsed.error || !parsed.value) {
    return Response.json({ data: null, error: parsed.error ?? "JSON inválido" } satisfies ActualizarTransferenciaFinancieraResponse, { status: 400 });
  }

  const input = parsed.value;
  const { data: currentData, error: currentError } = await supabase.rpc("rpc_finanzas_obtener_transferencia", {
    p_transferencia_id: id,
  });
  const current = firstTransferencia(currentData);
  if (currentError || !current) {
    const status = currentError ? rpcStatus(currentError) : 404;
    return Response.json(
      { data: null, error: status === 404 ? "Transferencia no encontrada" : "Error cargando transferencia" } satisfies ActualizarTransferenciaFinancieraResponse,
      { status }
    );
  }

  const { data: updated, error: updateError } = await supabase.rpc("rpc_finanzas_actualizar_transferencia", {
    p_transferencia_id: id,
    p_cuenta_origen_id: input.cuentaOrigenId ?? current.cuentaOrigenId,
    p_cuenta_destino_id: input.cuentaDestinoId ?? current.cuentaDestinoId,
    p_importe: input.importe ?? current.importe,
    p_fecha: input.fecha ?? current.fecha,
    p_descripcion: input.descripcion === undefined ? current.descripcion : input.descripcion,
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  if (updateError) {
    const status = rpcStatus(updateError);
    return Response.json(
      { data: null, error: status === 404 ? "Transferencia no encontrada" : "Error actualizando transferencia" } satisfies ActualizarTransferenciaFinancieraResponse,
      { status }
    );
  }

  const inlineTransferencia = firstTransferencia(updated);
  if (inlineTransferencia) {
    return Response.json({ data: inlineTransferencia, error: null } satisfies ActualizarTransferenciaFinancieraResponse, { status: 200 });
  }
  const updatedId = extractRpcId(updated);
  if (!updatedId) {
    return Response.json(
      { data: null, error: "Respuesta inválida al actualizar transferencia" } satisfies ActualizarTransferenciaFinancieraResponse,
      { status: 500 }
    );
  }
  const { data: fetched, error: fetchError } = await supabase.rpc("rpc_finanzas_obtener_transferencia", {
    p_transferencia_id: updatedId,
  });
  const transferencia = firstTransferencia(fetched);
  if (fetchError || !transferencia) {
    return Response.json(
      { data: null, error: fetchError && rpcStatus(fetchError) === 404 ? "Transferencia no encontrada" : "No se pudo recuperar la transferencia actualizada" } satisfies ActualizarTransferenciaFinancieraResponse,
      { status: fetchError ? rpcStatus(fetchError) : 500 }
    );
  }
  return Response.json({ data: transferencia, error: null } satisfies ActualizarTransferenciaFinancieraResponse, { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ error: "Unauthorized" } satisfies EliminarFinanzasResponse, { status: 401 });
  }

  const { id } = await params;
  const idError = validateUuid(id, "transferenciaId");
  if (idError) return Response.json({ error: idError } satisfies EliminarFinanzasResponse, { status: 400 });
  const idempotencyKey = req.headers.get("x-idempotency-key")?.trim();
  const idempotencyError = validateUuid(idempotencyKey, "X-Idempotency-Key");
  if (idempotencyError) return Response.json({ error: idempotencyError } satisfies EliminarFinanzasResponse, { status: 400 });

  const { data, error } = await supabase.rpc("rpc_finanzas_eliminar_transferencia", {
    p_transferencia_id: id,
    p_idempotency_key: idempotencyKey,
  });
  if (error || data === false) {
    const status = data === false ? 404 : rpcStatus(error);
    return Response.json(
      { error: status === 404 ? "Transferencia no encontrada" : "Error eliminando transferencia" } satisfies EliminarFinanzasResponse,
      { status }
    );
  }
  return Response.json({ error: null } satisfies EliminarFinanzasResponse, { status: 200 });
}
