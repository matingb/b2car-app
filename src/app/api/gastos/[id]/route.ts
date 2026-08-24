import type { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import type {
  ActualizarGastoFinancieroResponse,
  EliminarFinanzasResponse,
  GastoFinanciero,
  ObtenerGastoFinancieroResponse,
} from "@/model/finanzas";
import {
  mapGasto,
  rpcStatus,
  validateUpdateGasto,
  validateUuid,
} from "../../cuentas-financieras/finanzasRouteUtils";

type RouteContext = { params: Promise<{ id: string }> };

async function fetchGastoById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<{ data: GastoFinanciero | null; error: unknown }> {
  const { data, error } = await supabase.rpc("rpc_listar_operaciones_con_gastos", {
    p_tipos: ["GASTO"],
    p_page: 1,
    p_page_size: 200,
  });
  if (error) return { data: null, error };
  const rows = Array.isArray(data) ? data : [];
  const found = rows.find((r: { id: string }) => r.id === id);
  if (!found) return { data: null, error: null };
  return { data: mapGasto(found), error: null };
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

  const { data: gasto, error } = await fetchGastoById(supabase, id);
  if (error || !gasto) {
    return Response.json(
      { data: null, error: !gasto ? "Gasto no encontrado" : "Error cargando gasto" } satisfies ObtenerGastoFinancieroResponse,
      { status: !gasto ? 404 : 500 }
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
  const { data: current, error: currentError } = await fetchGastoById(supabase, id);
  if (currentError || !current) {
    return Response.json(
      { data: null, error: "Gasto no encontrado" } satisfies ActualizarGastoFinancieroResponse,
      { status: 404 }
    );
  }

  const { error: updateError } = await supabase.rpc("rpc_actualizar_movimiento_cuenta", {
    p_operacion_id: id,
    p_cuenta_id: input.cuentaId ?? current.cuentaId,
    p_categoria_gasto: input.categoria ?? current.categoria,
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

  const { data: refreshed } = await fetchGastoById(supabase, id);
  const resultGasto: GastoFinanciero = refreshed ?? {
    ...current,
    cuentaId: input.cuentaId ?? current.cuentaId,
    categoria: input.categoria ?? current.categoria,
    importe: input.importe ?? current.importe,
    descripcion: input.descripcion ?? current.descripcion,
    fecha: input.fecha ?? current.fecha,
  };
  return Response.json({ data: resultGasto, error: null } satisfies ActualizarGastoFinancieroResponse, { status: 200 });
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

  const { data, error } = await supabase.rpc("rpc_eliminar_movimiento_cuenta", {
    p_operacion_id: id,
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

