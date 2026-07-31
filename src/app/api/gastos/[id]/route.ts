import type { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import type {
  ActualizarGastoFinancieroResponse,
  EliminarFinanzasResponse,
  ObtenerGastoFinancieroResponse,
} from "@/model/finanzas";
import {
  asRows,
  extractRpcId,
  mapGasto,
  rpcStatus,
  validateUpdateGasto,
  validateUuid,
} from "../../cuentas-financieras/finanzasRouteUtils";

type RouteContext = { params: Promise<{ id: string }> };

function firstGasto(data: unknown) {
  return mapGasto(asRows(data)[0]);
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies ObtenerGastoFinancieroResponse, { status: 401 });
  }

  const { id } = await params;
  const idError = validateUuid(id, "gastoId");
  if (idError) return Response.json({ data: null, error: idError } satisfies ObtenerGastoFinancieroResponse, { status: 400 });

  const { data, error } = await supabase.rpc("rpc_finanzas_obtener_gasto", { p_gasto_id: id });
  const gasto = firstGasto(data);
  if (error || !gasto) {
    const status = error ? rpcStatus(error) : 404;
    return Response.json(
      { data: null, error: status === 404 ? "Gasto no encontrado" : "Error cargando gasto" } satisfies ObtenerGastoFinancieroResponse,
      { status }
    );
  }
  return Response.json({ data: gasto, error: null } satisfies ObtenerGastoFinancieroResponse, { status: 200 });
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies ActualizarGastoFinancieroResponse, { status: 401 });
  }

  const { id } = await params;
  const idError = validateUuid(id, "gastoId");
  if (idError) return Response.json({ data: null, error: idError } satisfies ActualizarGastoFinancieroResponse, { status: 400 });
  const parsed = validateUpdateGasto(await req.json().catch(() => null));
  if (parsed.error || !parsed.value) {
    return Response.json({ data: null, error: parsed.error ?? "JSON inválido" } satisfies ActualizarGastoFinancieroResponse, { status: 400 });
  }

  const input = parsed.value;
  const { data: currentData, error: currentError } = await supabase.rpc("rpc_finanzas_obtener_gasto", {
    p_gasto_id: id,
  });
  const current = firstGasto(currentData);
  if (currentError || !current) {
    const status = currentError ? rpcStatus(currentError) : 404;
    return Response.json(
      { data: null, error: status === 404 ? "Gasto no encontrado" : "Error cargando gasto" } satisfies ActualizarGastoFinancieroResponse,
      { status }
    );
  }

  const { data: updated, error: updateError } = await supabase.rpc("rpc_finanzas_actualizar_gasto", {
    p_gasto_id: id,
    p_cuenta_id: input.cuentaId ?? current.cuentaId,
    p_categoria: input.categoria ?? current.categoria,
    p_importe: input.importe ?? current.importe,
    p_descripcion: input.descripcion ?? current.descripcion,
    p_fecha: input.fecha ?? current.fecha,
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  if (updateError) {
    const status = rpcStatus(updateError);
    return Response.json(
      { data: null, error: status === 404 ? "Gasto no encontrado" : "Error actualizando gasto" } satisfies ActualizarGastoFinancieroResponse,
      { status }
    );
  }

  const inlineGasto = firstGasto(updated);
  if (inlineGasto) {
    return Response.json({ data: inlineGasto, error: null } satisfies ActualizarGastoFinancieroResponse, { status: 200 });
  }
  const updatedId = extractRpcId(updated);
  if (!updatedId) {
    return Response.json(
      { data: null, error: "Respuesta inválida al actualizar gasto" } satisfies ActualizarGastoFinancieroResponse,
      { status: 500 }
    );
  }
  const { data: fetched, error: fetchError } = await supabase.rpc("rpc_finanzas_obtener_gasto", { p_gasto_id: updatedId });
  const gasto = firstGasto(fetched);
  if (fetchError || !gasto) {
    return Response.json(
      { data: null, error: fetchError && rpcStatus(fetchError) === 404 ? "Gasto no encontrado" : "No se pudo recuperar el gasto actualizado" } satisfies ActualizarGastoFinancieroResponse,
      { status: fetchError ? rpcStatus(fetchError) : 500 }
    );
  }
  return Response.json({ data: gasto, error: null } satisfies ActualizarGastoFinancieroResponse, { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ error: "Unauthorized" } satisfies EliminarFinanzasResponse, { status: 401 });
  }

  const { id } = await params;
  const idError = validateUuid(id, "gastoId");
  if (idError) return Response.json({ error: idError } satisfies EliminarFinanzasResponse, { status: 400 });
  const idempotencyKey = req.headers.get("x-idempotency-key")?.trim();
  const idempotencyError = validateUuid(idempotencyKey, "X-Idempotency-Key");
  if (idempotencyError) return Response.json({ error: idempotencyError } satisfies EliminarFinanzasResponse, { status: 400 });

  const { data, error } = await supabase.rpc("rpc_finanzas_eliminar_gasto", {
    p_gasto_id: id,
    p_idempotency_key: idempotencyKey,
  });
  if (error || data === false) {
    const status = data === false ? 404 : rpcStatus(error);
    return Response.json(
      { error: status === 404 ? "Gasto no encontrado" : "Error eliminando gasto" } satisfies EliminarFinanzasResponse,
      { status }
    );
  }
  return Response.json({ error: null } satisfies EliminarFinanzasResponse, { status: 200 });
}
