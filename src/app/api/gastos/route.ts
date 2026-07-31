import { createClient } from "@/supabase/server";
import type {
  CrearGastoFinancieroResponse,
  ListarGastosFinancierosResponse,
} from "@/model/finanzas";
import {
  asRows,
  extractRpcId,
  mapGasto,
  mapRows,
  parseListFilters,
  rpcStatus,
  validateCreateGasto,
} from "../cuentas-financieras/finanzasRouteUtils";

function firstGasto(data: unknown) {
  return mapGasto(asRows(data)[0]);
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies ListarGastosFinancierosResponse, { status: 401 });
  }

  const url = new URL(req.url);
  const filters = parseListFilters(url);
  if (filters.error || !filters.value) {
    return Response.json({ data: null, error: filters.error ?? "Filtros inválidos" } satisfies ListarGastosFinancierosResponse, { status: 400 });
  }
  const { data, error } = await supabase.rpc("rpc_finanzas_listar_gastos", {
    p_from: filters.value.desde,
    p_to: filters.value.hasta,
    p_limit: filters.value.limit,
    p_offset: filters.value.offset,
  });
  if (error) {
    return Response.json(
      { data: [], error: "Error listando gastos" } satisfies ListarGastosFinancierosResponse,
      { status: rpcStatus(error) }
    );
  }

  const gastos = mapRows(data, mapGasto);
  if (!gastos) {
    return Response.json(
      { data: [], error: "Respuesta inválida al listar gastos" } satisfies ListarGastosFinancierosResponse,
      { status: 500 }
    );
  }
  return Response.json({ data: gastos, error: null } satisfies ListarGastosFinancierosResponse, { status: 200 });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies CrearGastoFinancieroResponse, { status: 401 });
  }

  const parsed = validateCreateGasto(await req.json().catch(() => null));
  if (parsed.error || !parsed.value) {
    return Response.json({ data: null, error: parsed.error ?? "JSON inválido" } satisfies CrearGastoFinancieroResponse, { status: 400 });
  }

  const input = parsed.value;
  const { data: created, error: createError } = await supabase.rpc("rpc_finanzas_registrar_gasto", {
    p_cuenta_id: input.cuentaId,
    p_categoria: input.categoria,
    p_importe: input.importe,
    p_fecha: input.fecha ?? null,
    p_descripcion: input.descripcion,
    p_idempotency_key: input.idempotencyKey ?? null,
    p_arreglo_id: input.arregloId ?? null,
    p_operacion_id: input.operacionId ?? null,
  });
  if (createError) {
    return Response.json(
      { data: null, error: "Error registrando gasto" } satisfies CrearGastoFinancieroResponse,
      { status: rpcStatus(createError) }
    );
  }

  const inlineGasto = firstGasto(created);
  if (inlineGasto) {
    return Response.json({ data: inlineGasto, error: null } satisfies CrearGastoFinancieroResponse, { status: 201 });
  }
  const id = extractRpcId(created);
  if (!id) {
    return Response.json(
      { data: null, error: "Respuesta inválida al registrar gasto" } satisfies CrearGastoFinancieroResponse,
      { status: 500 }
    );
  }
  const { data: fetched, error: fetchError } = await supabase.rpc("rpc_finanzas_obtener_gasto", { p_gasto_id: id });
  const gasto = firstGasto(fetched);
  if (fetchError || !gasto) {
    return Response.json(
      { data: null, error: "No se pudo recuperar el gasto registrado" } satisfies CrearGastoFinancieroResponse,
      { status: fetchError ? rpcStatus(fetchError) : 500 }
    );
  }
  return Response.json({ data: gasto, error: null } satisfies CrearGastoFinancieroResponse, { status: 201 });
}
