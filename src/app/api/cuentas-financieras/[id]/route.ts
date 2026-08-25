import type { NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import type {
  ActualizarCuentaFinancieraResponse,
  EliminarFinanzasResponse,
  ObtenerCuentaFinancieraResponse,
} from "@/model/finanzas";
import {
  asRows,
  mapCuenta,
  rpcStatus,
  validateUpdateCuenta,
  validateUuid,
} from "../finanzasRouteUtils";

type RouteContext = { params: Promise<{ id: string }> };

function firstCuenta(data: unknown) {
  return mapCuenta(asRows(data)[0]);
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies ObtenerCuentaFinancieraResponse, { status: 401 });
  }

  const { id } = await params;
  const idError = validateUuid(id);
  if (idError) return Response.json({ data: null, error: idError } satisfies ObtenerCuentaFinancieraResponse, { status: 400 });

  const { data, error } = await supabase.rpc("rpc_finanzas_obtener_cuenta", { p_cuenta_id: id });
  const cuenta = firstCuenta(data);
  if (error || !cuenta) {
    const status = error ? rpcStatus(error) : 404;
    return Response.json(
      { data: null, error: status === 404 ? "Cuenta financiera no encontrada" : "Error cargando cuenta financiera" } satisfies ObtenerCuentaFinancieraResponse,
      { status }
    );
  }

  return Response.json({ data: cuenta, error: null } satisfies ObtenerCuentaFinancieraResponse, { status: 200 });
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies ActualizarCuentaFinancieraResponse, { status: 401 });
  }

  const { id } = await params;
  const idError = validateUuid(id);
  if (idError) return Response.json({ data: null, error: idError } satisfies ActualizarCuentaFinancieraResponse, { status: 400 });
  const parsed = validateUpdateCuenta(await req.json().catch(() => null));
  if (parsed.error || !parsed.value) {
    return Response.json({ data: null, error: parsed.error ?? "JSON inválido" } satisfies ActualizarCuentaFinancieraResponse, { status: 400 });
  }

  const input = parsed.value;
  const { data: updated, error: updateError } = await supabase.rpc("rpc_finanzas_actualizar_cuenta", {
    p_cuenta_id: id,
    p_nombre: input.nombre ?? null,
    p_tipo: input.tipo ?? null,
    p_activo: input.activo ?? null,
    p_favorita: input.favorita ?? null,
  });
  if (updateError) {
    return Response.json(
      { data: null, error: rpcStatus(updateError) === 404 ? "Cuenta financiera no encontrada" : "Error actualizando cuenta financiera" } satisfies ActualizarCuentaFinancieraResponse,
      { status: rpcStatus(updateError) }
    );
  }

  const inlineCuenta = firstCuenta(updated);
  if (inlineCuenta) {
    return Response.json({ data: inlineCuenta, error: null } satisfies ActualizarCuentaFinancieraResponse, { status: 200 });
  }
  const { data: fetched, error: fetchError } = await supabase.rpc("rpc_finanzas_obtener_cuenta", { p_cuenta_id: id });
  const cuenta = firstCuenta(fetched);
  if (fetchError || !cuenta) {
    return Response.json(
      { data: null, error: fetchError && rpcStatus(fetchError) === 404 ? "Cuenta financiera no encontrada" : "No se pudo recuperar la cuenta actualizada" } satisfies ActualizarCuentaFinancieraResponse,
      { status: fetchError ? rpcStatus(fetchError) : 500 }
    );
  }
  return Response.json({ data: cuenta, error: null } satisfies ActualizarCuentaFinancieraResponse, { status: 200 });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return Response.json({ error: "Unauthorized" } satisfies EliminarFinanzasResponse, { status: 401 });
  }

  const { id } = await params;
  const idError = validateUuid(id);
  if (idError) return Response.json({ error: idError } satisfies EliminarFinanzasResponse, { status: 400 });

  const { data, error } = await supabase.rpc("rpc_finanzas_eliminar_cuenta", { p_cuenta_id: id });
  if (error || data === false) {
    const status = data === false ? 404 : rpcStatus(error);
    return Response.json(
      { error: status === 404 ? "Cuenta financiera no encontrada" : "Error eliminando cuenta financiera" } satisfies EliminarFinanzasResponse,
      { status }
    );
  }
  return Response.json({ error: null } satisfies EliminarFinanzasResponse, { status: 200 });
}
