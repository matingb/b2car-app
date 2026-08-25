import { createClient } from "@/supabase/server";
import type {
  CrearCuentaFinancieraResponse,
  ListarCuentasFinancierasResponse,
} from "@/model/finanzas";
import {
  asRows,
  extractRpcId,
  mapCuenta,
  mapRows,
  rpcStatus,
  validateCreateCuenta,
} from "./finanzasRouteUtils";

function unauthorized<T>() {
  return Response.json({ data: null, error: "Unauthorized" } satisfies { data: T | null; error: string }, { status: 401 });
}

function firstCuenta(data: unknown) {
  return mapCuenta(asRows(data)[0]);
}

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) return unauthorized<never>();

  const { data, error } = await supabase.rpc("rpc_finanzas_listar_cuentas");
  if (error) {
    return Response.json(
      { data: [], error: "Error listando cuentas financieras" } satisfies ListarCuentasFinancierasResponse,
      { status: rpcStatus(error) }
    );
  }

  const cuentas = mapRows(data, mapCuenta);
  if (!cuentas) {
    return Response.json(
      { data: [], error: "Respuesta inválida al listar cuentas financieras" } satisfies ListarCuentasFinancierasResponse,
      { status: 500 }
    );
  }
  return Response.json(
    { data: cuentas, error: null } satisfies ListarCuentasFinancierasResponse,
    { status: 200 }
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) return unauthorized<never>();

  const parsed = validateCreateCuenta(await req.json().catch(() => null));
  if (parsed.error || !parsed.value) {
    return Response.json(
      { data: null, error: parsed.error ?? "JSON inválido" } satisfies CrearCuentaFinancieraResponse,
      { status: 400 }
    );
  }

  const input = parsed.value;
  const { data: created, error: createError } = await supabase.rpc("rpc_finanzas_crear_cuenta", {
    p_nombre: input.nombre,
    p_tipo: input.tipo,
    p_saldo_inicial: input.saldoInicial ?? 0,
    p_fecha: input.fecha ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  if (createError) {
    return Response.json(
      { data: null, error: "Error creando cuenta financiera" } satisfies CrearCuentaFinancieraResponse,
      { status: rpcStatus(createError) }
    );
  }

  const inlineCuenta = firstCuenta(created);
  if (inlineCuenta) {
    return Response.json({ data: inlineCuenta, error: null } satisfies CrearCuentaFinancieraResponse, { status: 201 });
  }

  const id = extractRpcId(created);
  if (!id) {
    return Response.json(
      { data: null, error: "Respuesta inválida al crear cuenta financiera" } satisfies CrearCuentaFinancieraResponse,
      { status: 500 }
    );
  }
  const { data: fetched, error: fetchError } = await supabase.rpc("rpc_finanzas_obtener_cuenta", {
    p_cuenta_id: id,
  });
  const cuenta = firstCuenta(fetched);
  if (fetchError || !cuenta) {
    return Response.json(
      { data: null, error: "No se pudo recuperar la cuenta creada" } satisfies CrearCuentaFinancieraResponse,
      { status: fetchError ? rpcStatus(fetchError) : 500 }
    );
  }
  return Response.json({ data: cuenta, error: null } satisfies CrearCuentaFinancieraResponse, { status: 201 });
}
