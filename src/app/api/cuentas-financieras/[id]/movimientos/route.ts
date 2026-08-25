import type { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import type { ListarMovimientosFinancierosResponse } from "@/model/finanzas";
import {
  mapMovimiento,
  mapRows,
  parseListFilters,
  rpcStatus,
  validateUuid,
} from "../../finanzasRouteUtils";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies ListarMovimientosFinancierosResponse, { status: 401 });
  }

  const { id } = await params;
  const idError = validateUuid(id, "cuentaId");
  if (idError) {
    return Response.json({ data: null, error: idError } satisfies ListarMovimientosFinancierosResponse, { status: 400 });
  }
  const filters = parseListFilters(req.nextUrl);
  if (filters.error || !filters.value) {
    return Response.json({ data: null, error: filters.error ?? "Filtros inválidos" } satisfies ListarMovimientosFinancierosResponse, { status: 400 });
  }

  const { data, error } = await supabase.rpc("rpc_listar_movimientos_cuenta", {
    p_cuenta_id: id,
    p_from: filters.value.desde,
    p_to: filters.value.hasta,
    p_limit: filters.value.limit,
    p_offset: filters.value.offset,
  });
  if (error) {
    return Response.json(
      { data: [], error: "Error listando movimientos financieros" } satisfies ListarMovimientosFinancierosResponse,
      { status: rpcStatus(error) }
    );
  }

  const movimientos = mapRows(data, mapMovimiento);
  if (!movimientos) {
    return Response.json(
      { data: [], error: "Respuesta inválida al listar movimientos financieros" } satisfies ListarMovimientosFinancierosResponse,
      { status: 500 }
    );
  }
  return Response.json(
    { data: movimientos, error: null } satisfies ListarMovimientosFinancierosResponse,
    { status: 200 }
  );
}
