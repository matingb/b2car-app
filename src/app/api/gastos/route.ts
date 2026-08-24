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
  const { data, error } = await supabase.rpc("rpc_listar_operaciones_con_gastos", {
    p_from: filters.value.desde,
    p_to: filters.value.hasta,
    p_tipos: ["GASTO"],
    p_page: 1,
    p_page_size: filters.value.limit,
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
  const { data: created, error: createError } = await supabase.rpc("rpc_crear_movimiento_cuenta", {
    p_subtipo: "GASTO",
    p_importe: input.importe,
    p_cuenta_id: input.cuentaId,
    p_categoria_gasto: input.categoria,
    p_descripcion: input.descripcion,
    p_fecha: input.fecha ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
    p_arreglo_id: input.arregloId ?? null,
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
  const { data: fetched, error: fetchError } = await supabase.rpc("rpc_listar_operaciones_con_gastos", {
    p_tipos: ["GASTO"],
    p_page: 1,
    p_page_size: 50,
  });
  const rows = Array.isArray(fetched) ? fetched : [];
  const found = rows.find((r: { id: string }) => r.id === id);
  const gasto = mapGasto(found);
  if (fetchError || !gasto) {
    // If list fetch didn't return row, create direct response
    return Response.json(
      {
        data: {
          id,
          cuentaId: input.cuentaId,
          categoria: input.categoria,
          importe: input.importe,
          fecha: input.fecha ?? new Date().toISOString(),
          descripcion: input.descripcion,
          reversaMovimientoId: null,
          createdAt: new Date().toISOString(),
        },
        error: null,
      } satisfies CrearGastoFinancieroResponse,
      { status: 201 }
    );
  }
  return Response.json({ data: gasto, error: null } satisfies CrearGastoFinancieroResponse, { status: 201 });
}

